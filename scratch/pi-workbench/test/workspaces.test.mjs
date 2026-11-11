import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkspaceStore } from '../workspaces.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
test('registers canonical named workspaces safely across concurrent requests', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'pi-workbench-workspaces-')); t.after(() => rm(root, { recursive: true, force: true }));
  const project = join(root, 'project'), state = join(root, 'state'); await mkdir(project); await symlink(project, join(root, 'alias'));
  const store = createWorkspaceStore(state), canonical = await realpath(project);
  assert.deepEqual(await store.list(), []);
  const [first, second] = await Promise.all([store.add(project, 'My Project'), store.add(join(root, 'alias'), 'My Project')]);
  assert.deepEqual(first, second); assert.equal(first.path, canonical); assert.equal(first.name, 'My Project'); assert.equal(first.archived, false);
  assert.deepEqual(await store.list(), [first]);
  assert.equal((await readdir(join(state, 'workspaces'))).filter((name) => name.endsWith('.json')).length, 1);
  assert.deepEqual(await store.add(project, 'Do not overwrite'), first);
  const archived = await store.update(first.path, { archived: true }, first.revision);
  assert.deepEqual(await store.add(project, 'Do not restore'), archived);
  await assert.rejects(store.add('relative'), /absolute/);
  await assert.rejects(store.add(project, '  '), /name/);
  await writeFile(join(root, 'not-a-directory'), 'fixture'); await assert.rejects(store.add(join(root, 'not-a-directory')), /existing folder/);
});

test('reads legacy records without rewriting and upgrades only on explicit changes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'pi-workbench-workspaces-legacy-')); t.after(() => rm(root, { recursive: true, force: true }));
  const dir = join(root, 'workspaces'), path = '/example/legacy'; await mkdir(dir);
  const file = join(dir, `${hash(path)}.json`), raw = `${JSON.stringify({ version: 1, path })}\n`; await writeFile(file, raw);
  const store = createWorkspaceStore(root); const [legacy] = await store.list();
  assert.deepEqual(legacy, { path, name: 'legacy', archived: false, revision: hash(raw) });
  assert.equal(await readFile(file, 'utf8'), raw);
  const named = await store.update(path, { name: 'Friendly' }, legacy.revision);
  assert.equal(named.name, 'Friendly'); assert.equal(named.archived, false); assert.equal(JSON.parse(await readFile(file, 'utf8')).version, 2);
  const archived = await store.update(path, { archived: true }, named.revision);
  assert.equal(archived.name, 'Friendly'); assert.equal(archived.archived, true);
  const restored = await store.update(path, { archived: false }, archived.revision);
  assert.equal(restored.name, 'Friendly'); assert.equal(restored.archived, false);
  assert.deepEqual(await store.list(), [restored]);
  await assert.rejects(store.update(path, { name: 'Stale' }, legacy.revision), /changed/);
  assert.deepEqual(await store.list(), [restored]);
});

test('derives a valid fallback name for unusual legacy directory names', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'pi-workbench-workspaces-name-')); t.after(() => rm(root, { recursive: true, force: true }));
  const dir = join(root, 'workspaces'), path = `/example/${'x'.repeat(160)}\n`; await mkdir(dir);
  await writeFile(join(dir, `${hash(path)}.json`), `${JSON.stringify({ version: 1, path })}\n`);
  const store = createWorkspaceStore(root); const [before] = await store.list();
  assert.equal(before.name.length, 120); assert.doesNotMatch(before.name, /[\r\n]/);
  const after = await store.update(path, { archived: true }, before.revision);
  assert.equal(after.archived, true); assert.deepEqual(await store.list(), [after]);
});

test('concurrent updates cannot silently overwrite one another', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'pi-workbench-workspaces-race-')); t.after(() => rm(root, { recursive: true, force: true }));
  const project = join(root, 'project'); await mkdir(project);
  const store = createWorkspaceStore(root); const before = await store.add(project);
  const results = await Promise.allSettled([store.update(before.path, { name: 'New name' }, before.revision), store.update(before.path, { archived: true }, before.revision)]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.match(results.find((result) => result.status === 'rejected').reason.message, /in use|changed/);
  const [after] = await store.list(); assert.deepEqual(after, results.find((result) => result.status === 'fulfilled').value);
  await assert.rejects(store.update(before.path, { name: '\n' }, after.revision), /name/);
  await assert.rejects(store.update(before.path, { archived: 'yes' }, after.revision), /archive/);
  assert.deepEqual(await store.list(), [after]);
});

test('preserves a stale workspace lock instead of clearing it', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'pi-workbench-workspaces-lock-')); t.after(() => rm(root, { recursive: true, force: true }));
  const project = join(root, 'project'); await mkdir(project); const store = createWorkspaceStore(root), record = await store.add(project);
  const lock = join(root, 'workspaces', `${hash(record.path)}.lock`); await mkdir(lock); await writeFile(join(lock, 'owner.json'), 'fixture');
  await assert.rejects(store.update(record.path, { name: 'Blocked' }, record.revision), /stale lock/);
  assert.equal(await readFile(join(lock, 'owner.json'), 'utf8'), 'fixture'); assert.deepEqual(await store.list(), [record]);
});

test('preserves invalid workspace metadata instead of repairing it', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'pi-workbench-workspaces-invalid-')); t.after(() => rm(root, { recursive: true, force: true }));
  const dir = join(root, 'workspaces'); await mkdir(dir); const file = join(dir, 'invalid.json'); await writeFile(file, '{invalid');
  const store = createWorkspaceStore(root); await assert.rejects(store.list(), /invalid/);
  assert.equal(await readFile(file, 'utf8'), '{invalid');
});
