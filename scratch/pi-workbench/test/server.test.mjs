import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request } from 'node:http';
import { createServerFor, createWorkbench } from '../server.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'pi-workbench-test-')); t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, '.hidden')); await writeFile(join(root, '.hidden', 'note.md'), '# original\r\n');
  await writeFile(join(root, 'private.json'), '{}'); await symlink('/tmp', join(root, 'outside'));
  return { root, store: await createWorkbench(root) };
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

test('HTTP rejects cross-origin writes and foreign host headers', async (t) => {
  const { store } = await fixture(t); const server = createServerFor(store);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${url}/api/list`)).status, 200);
  const foreignHostStatus = await new Promise((resolve, reject) => {
    const req = request(`${url}/api/list`, { headers: { host: 'attacker.example' } }, (response) => { response.resume(); resolve(response.statusCode); });
    req.on('error', reject); req.end();
  });
  assert.equal(foreignHostStatus, 403);
  assert.equal((await fetch(`${url}/api/file`, { method: 'POST', headers: { origin: 'https://attacker.example', 'content-type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await fetch(`${url}/api/file`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 403);
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
