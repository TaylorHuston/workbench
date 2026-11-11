import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm, rename, readdir } from 'node:fs/promises';
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
  assert.equal((await fetch(`${url}/api/agent/state`, { headers: { origin: 'https://attacker.example' } })).status, 403);
  assert.equal(agentCalls, 0);
  assert.equal((await fetch(`${url}/api/agent/send`, { method: 'POST', headers: { origin: url, 'content-type': 'application/json' }, body: JSON.stringify({ id: 'stale', message: 'fixture' }) })).status, 400);
  assert.equal(agentCalls, 0);
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
