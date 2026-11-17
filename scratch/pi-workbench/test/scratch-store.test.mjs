import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createScratchStore } from '../scratch-store.mjs';

test('scratch files are per-session, persistent and conflict checked', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'pi-scratch-')); t.after(() => rm(root, { recursive: true, force: true }));
  const store = createScratchStore(join(root, 'scratch')), a = 'a'.repeat(64), b = 'b'.repeat(64);
  const first = await store.read(a); assert.equal(first.content, '');
  await store.save(a, '# Notes\n', first.version); assert.equal((await store.read(a)).content, '# Notes\n');
  assert.equal((await store.read(b)).content, '');
  const before = await store.read(a); await writeFile(before.path, 'agent edits\n');
  await assert.rejects(store.save(a, 'user edits\n', before.version), /changed on disk/);
  assert.equal(await readFile(before.path, 'utf8'), 'agent edits\n');
  await assert.rejects(store.read('../escape'), /Invalid session key/);
  await symlink(before.path, store.pathFor('c'.repeat(64))); await assert.rejects(store.read('c'.repeat(64)), /regular file/);
});
