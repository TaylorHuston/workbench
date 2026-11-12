import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, realpath, writeFile, symlink, rm, rename, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { request } from 'node:http';
import { createServerFor, createWorkbench } from '../server.mjs';

async function fixture(t) {
  const base = await mkdtemp(join(tmpdir(), 'pi-workbench-test-')); t.after(() => rm(base, { recursive: true, force: true }));
  const root = join(base, 'root'), trashDir = join(base, 'trash'); await mkdir(root); await mkdir(trashDir);
  await mkdir(join(root, '.hidden')); await writeFile(join(root, '.hidden', 'note.md'), '# original\r\n');
  await writeFile(join(root, 'private.json'), '{}'); await symlink('/tmp', join(root, 'outside'));
  return { root, trashDir, store: await createWorkbench(root, { trash: (path) => rename(path, join(trashDir, basename(path))) }) };
}

test('lists hidden directories and Markdown, excludes non-Markdown and symlinks', async (t) => {
  const { store } = await fixture(t);
  assert.deepEqual((await store.list('')).map((item) => item.name), ['.hidden']);
  assert.deepEqual((await store.list('.hidden')).map((item) => item.name), ['note.md']);
  await assert.rejects(store.read('private.json'), /Markdown/);
  await assert.rejects(store.list('../'), /Invalid path/);
  await assert.rejects(store.list('outside'), /Symbolic links/);
});

test('resolves relative links and unambiguous wikilinks without escaping the workspace', async (t) => {
  const { root, store } = await fixture(t);
  await writeFile(join(root, 'start.md'), '# start');
  assert.deepEqual(await store.resolveLink('start.md', '.hidden/note.md', false), { path: '.hidden/note.md' });
  assert.deepEqual(await store.resolveLink('start.md', 'note', true), { path: '.hidden/note.md' });
  await writeFile(join(root, 'note.md'), '# duplicate');
  await assert.rejects(store.resolveLink('start.md', 'note', true), /ambiguous/);
  await assert.rejects(store.resolveLink('start.md', '../note.md', false), /outside/);
  await assert.rejects(store.resolveLink('start.md', 'outside/note.md', false), /Symbolic/);
  await assert.rejects(store.resolveLink('start.md', 'note#heading', true), /Unsupported/);
});

test('reads, saves and refuses stale writes without overwriting', async (t) => {
  const { root, store } = await fixture(t); const path = '.hidden/note.md';
  const first = await store.read(path); assert.equal(first.lineEnding, 'crlf'); assert.equal(first.content, '# original\r\n');
  const saved = await store.save(path, '# updated\r\n', first.version); assert.notEqual(saved.version, first.version);
  await assert.rejects(store.save(path, 'stale', first.version), /changed on disk/);
  assert.equal(await readFile(join(root, path), 'utf8'), '# updated\r\n');
  await writeFile(join(root, path), 'mixed\r\nlines\n'); await assert.rejects(store.read(path), /Mixed/);
});

test('creates Markdown and folders without overwriting or escaping the root', async (t) => {
  const { root, store } = await fixture(t);
  assert.deepEqual(await store.create('', 'notes', 'directory'), { path: 'notes' });
  assert.deepEqual(await store.create('notes', 'one.md', 'file'), { path: 'notes/one.md' });
  assert.equal(await readFile(join(root, 'notes/one.md'), 'utf8'), '');
  await assert.rejects(store.create('notes', 'one.md', 'file'), /exist/i);
  await assert.rejects(store.create('', 'bad.txt', 'file'), /\.md/);
  await assert.rejects(store.create('', '../escape', 'directory'), /valid name/);
  await assert.rejects(store.create('outside', 'escape.md', 'file'), /Symbolic links/);
});

test('renames files and folders without replacing existing items', async (t) => {
  const { root, store } = await fixture(t);
  const file = await store.inspect('.hidden/note.md', 'file');
  await assert.rejects(store.rename('.hidden/note.md', 'file', 'note.txt', file.version), /\.md/);
  await store.create('.hidden', 'other.md', 'file');
  await assert.rejects(store.rename('.hidden/note.md', 'file', 'other.md', file.version), /already exists/);
  await store.rename('.hidden/note.md', 'file', 'renamed.md', file.version);
  assert.equal(await readFile(join(root, '.hidden/renamed.md'), 'utf8'), '# original\r\n');
  const folder = await store.inspect('.hidden', 'directory');
  await store.rename('.hidden', 'directory', 'renamed', folder.version);
  assert.equal(await readFile(join(root, 'renamed/renamed.md'), 'utf8'), '# original\r\n');
});

test('moves files and empty folders to an injected Trash; rejects stale and nonempty items', async (t) => {
  const { root, trashDir, store } = await fixture(t);
  await assert.rejects(store.inspect('', 'directory'), /Choose/);
  const dir = await store.inspect('.hidden', 'directory');
  await assert.rejects(store.remove('.hidden', 'directory', dir.version), /empty/);
  const file = await store.inspect('.hidden/note.md', 'file');
  await writeFile(join(root, '.hidden/note.md'), 'changed');
  await assert.rejects(store.remove('.hidden/note.md', 'file', file.version), /changed/);
  const fresh = await store.inspect('.hidden/note.md', 'file');
  await store.remove('.hidden/note.md', 'file', fresh.version);
  assert.equal(await readFile(join(trashDir, 'note.md'), 'utf8'), 'changed');
  await writeFile(join(root, '.hidden', '.keep'), 'hidden non-Markdown data');
  const hiddenContent = await store.inspect('.hidden', 'directory');
  await assert.rejects(store.remove('.hidden', 'directory', hiddenContent.version), /empty/);
  await rm(join(root, '.hidden', '.keep'));
  const empty = await store.inspect('.hidden', 'directory');
  await store.remove('.hidden', 'directory', empty.version);
  assert.deepEqual((await readdir(trashDir)).sort(), ['.hidden', 'note.md']);
});

test('HTTP scopes Markdown file operations to the selected workspace', async (t) => {
  const { root, trashDir, store } = await fixture(t); const other = join(root, 'other'); await mkdir(other);
  await writeFile(join(other, 'note.md'), '# other\n'); await writeFile(join(other, 'private.txt'), 'not listed');
  await symlink(join(root, '.hidden'), join(other, 'outside'));
  const server = createServerFor(store, undefined, { createWorkspace: (path) => createWorkbench(path, { trash: (file) => rename(file, join(trashDir, basename(file))), move: rename }) });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const q = (path, workspace = other) => new URLSearchParams({ workspace, path }).toString();
  const defaultRoot = await (await fetch(`${url}/api/workspace-root`)).json();
  assert.equal(defaultRoot.root, await realpath(root)); assert.equal(defaultRoot.label, await realpath(root)); assert.match(defaultRoot.id, /^[a-f0-9]{64}$/);
  assert.deepEqual((await (await fetch(`${url}/api/list?${q('')}`)).json()).map((item) => item.name), ['note.md']);
  assert.equal((await fetch(`${url}/api/list?${q('outside')}`)).status, 400);
  assert.equal((await fetch(`${url}/api/list?${q('', 'relative')}`)).status, 400);
  const file = await (await fetch(`${url}/api/file?${q('note.md')}`)).json(); assert.equal(file.content, '# other\n');
  const post = (route, body) => fetch(`${url}${route}`, { method: 'POST', headers: { origin: url, 'content-type': 'application/json' }, body: JSON.stringify({ workspace: other, ...body }) });
  assert.equal((await post('/api/file', { path: 'note.md', content: '# updated\n', version: file.version })).status, 200);
  assert.equal(await readFile(join(root, '.hidden/note.md'), 'utf8'), '# original\r\n');
  const identity = await (await fetch(`${url}/api/entry?${q('note.md')}&kind=file`)).json();
  assert.equal((await post('/api/entry', { action: 'rename', path: 'note.md', kind: 'file', name: 'renamed.md', version: identity.version })).status, 200);
  const renamed = await (await fetch(`${url}/api/entry?${q('renamed.md')}&kind=file`)).json();
  assert.equal((await post('/api/entry', { action: 'trash', path: 'renamed.md', kind: 'file', version: renamed.version })).status, 200);
  assert.equal(await readFile(join(trashDir, 'renamed.md'), 'utf8'), '# updated\n');
  assert.equal(await readFile(join(root, '.hidden/note.md'), 'utf8'), '# original\r\n');
});

test('HTTP lists, names and archives workspaces and creates a session', async (t) => {
  const { root, store } = await fixture(t); const calls = [];
  const other = join(root, 'other'); await mkdir(other); const cwd = await realpath(other);
  const workspace = { path: cwd, name: 'Fixture', archived: false, revision: 'a'.repeat(64) };
  const agent = {
    listWorkspaces: async () => [workspace],
    addWorkspace: async (path, name) => { calls.push(['workspace', path, name]); return { cwd: path, workspace }; },
    updateWorkspace: async (path, changes, revision) => { calls.push(['update', path, changes, revision]); return { workspace: { ...workspace, ...changes } }; },
    createSession: async (path) => { calls.push(['session', path]); return { cwd: path, key: 'new' }; },
  };
  const server = createServerFor(store, agent);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.deepEqual(await (await fetch(`${url}/api/agent/workspaces`)).json(), [workspace]);
  const post = (route, body) => fetch(`${url}/api/agent/${route}`, { method: 'POST', headers: { origin: url, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  let response = await post('workspaces', { cwd, name: 'Fixture' }); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { cwd, workspace });
  response = await post('workspaces', { action: 'update', cwd, changes: { archived: true }, revision: workspace.revision });
  assert.equal(response.status, 200); assert.equal((await response.json()).workspace.archived, true);
  response = await post('new', { cwd }); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { cwd, key: 'new' });
  assert.equal((await post('workspaces', { cwd: await realpath(root), name: 'Default' })).status, 400);
  assert.equal((await post('workspaces', { action: 'update', cwd: await realpath(root), changes: { archived: true }, revision: workspace.revision })).status, 400);
  assert.deepEqual(calls, [['workspace', cwd, 'Fixture'], ['update', cwd, { archived: true }, workspace.revision], ['session', cwd]]);
});

test('HTTP accepts dialog replies during session startup and rejects cross-origin replies', async (t) => {
  const { store } = await fixture(t); const calls = [];
  const agent = { respondDialog: (id, value) => { calls.push([id, value]); } };
  const server = createServerFor(store, agent);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (origin) => fetch(`${url}/api/agent/dialog`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ id: 'request', value: true }) });
  assert.equal((await post('https://attacker.example')).status, 403); assert.deepEqual(calls, []);
  assert.equal((await post(url)).status, 200); assert.deepEqual(calls, [['request', true]]);
});

test('HTTP validates active-session document context before sending', async (t) => {
  const { root, store } = await fixture(t); const calls = [];
  const agent = { snapshot: () => ({ key: 'current', cwd: root }), send: (message, document) => { calls.push([message, document]); return { accepted: true }; } };
  const server = createServerFor(store, agent);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (body) => fetch(`${url}/api/agent/send`, { method: 'POST', headers: { origin: url, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post({ key: 'current', message: 'question', document: '../secret.md' })).status, 400);
  assert.equal((await post({ key: 'current', message: 'question', document: 'outside/note.md' })).status, 400);
  assert.equal((await post({ key: 'stale', message: 'question', document: '.hidden/note.md' })).status, 400);
  assert.deepEqual(calls, []);
  assert.equal((await post({ key: 'current', message: 'question', document: '.hidden/note.md' })).status, 200);
  assert.deepEqual(calls, [['question', '.hidden/note.md']]);
});

test('HTTP reload targets only the open session', async (t) => {
  const { store } = await fixture(t); const calls = [];
  const agent = { snapshot: () => ({ key: 'current' }), reload: async (key) => { calls.push(key); return { key, reloading: false }; } };
  const server = createServerFor(store, agent);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const post = (key) => fetch(`${url}/api/agent/reload`, { method: 'POST', headers: { origin: url, 'content-type': 'application/json' }, body: JSON.stringify({ key }) });
  assert.equal((await post('stale')).status, 400); assert.deepEqual(calls, []);
  const response = await post('current'); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { key: 'current', reloading: false });
  assert.deepEqual(calls, ['current']);
});

test('HTTP rejects cross-origin writes and foreign host headers', async (t) => {
  const { store } = await fixture(t); let agentCalls = 0;
  const agent = { send() { agentCalls++; return { accepted: true }; }, snapshot() { return null; } };
  const server = createServerFor(store, agent);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${url}/api/list`)).status, 200);
  const foreignHostStatus = await new Promise((resolve, reject) => {
    const req = request(`${url}/api/list`, { headers: { host: 'attacker.example' } }, (response) => { response.resume(); resolve(response.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(foreignHostStatus, 403);
  assert.equal((await fetch(`${url}/api/file`, { method: 'POST', headers: { origin: 'https://attacker.example', 'content-type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(`${url}/api/entry`, { method: 'POST', headers: { origin: 'https://attacker.example', 'content-type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(`${url}/api/agent/send`, { method: 'POST', headers: { origin: 'https://attacker.example', 'content-type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(`${url}/api/agent/archive`, { method: 'POST', headers: { origin: 'https://attacker.example', 'content-type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(`${url}/api/agent/reload`, { method: 'POST', headers: { origin: 'https://attacker.example', 'content-type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(`${url}/api/agent/new`, { method: 'POST', headers: { origin: 'https://attacker.example', 'content-type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(`${url}/api/agent/workspaces`, { method: 'POST', headers: { origin: 'https://attacker.example', 'content-type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(`${url}/api/agent/state`, { headers: { origin: 'https://attacker.example' } })).status, 403);
  assert.equal(agentCalls, 0);
  assert.equal((await fetch(`${url}/api/agent/send`, { method: 'POST', headers: { origin: url, 'content-type': 'application/json' }, body: JSON.stringify({ id: 'stale', message: 'fixture' }) })).status, 400);
  assert.equal(agentCalls, 0);
  assert.equal((await fetch(`${url}/api/agent/reload`, { method: 'POST', headers: { origin: url, 'content-type': 'application/json' }, body: JSON.stringify({ key: 'stale' }) })).status, 400);
  assert.equal((await fetch(`${url}/api/file`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 403);
  const created = await fetch(`${url}/api/entry`, { method: 'POST', headers: { origin: url, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'create', parent: '', name: 'new.md', kind: 'file' }) });
  assert.equal(created.status, 200);
  assert.deepEqual(await created.json(), { path: 'new.md' });
  const original = await store.read('.hidden/note.md');
  const body = Buffer.from(JSON.stringify({ path: '.hidden/note.md', content: 'hello 🌲\n', version: original.version }));
  const split = body.indexOf(Buffer.from('🌲')) + 1;
  const saved = await new Promise((resolve, reject) => {
    const req = request(`${url}/api/file`, { method: 'POST', headers: { origin: url, 'content-type': 'application/json' } }, (response) => { response.resume(); resolve(response.statusCode); });
    req.on('error', reject); req.write(body.subarray(0, split)); req.end(body.subarray(split));
  });
  assert.equal(saved, 200);
  assert.equal((await store.read('.hidden/note.md')).content, 'hello 🌲\n');
});
