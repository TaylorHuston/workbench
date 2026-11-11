import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTask, readTask, appendTask, updateCurrentState, listOpenTasks } from './store.mjs';

test('task create, list, attributed append, guarded state update and preservation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pi-tasks-test-'));
  try {
    const id = '2026-11/2026-11-10-test';
    await createTask(root, id, 'Test', 'Goal', 'Next: test');
    await assert.rejects(createTask(root, id, 'Duplicate', 'Goal', 'State'), { code: 'EEXIST' });
    assert.deepEqual(await listOpenTasks(root), [{ id, status: 'active', title: 'Test' }]);
    const session = { harness: 'pi', id: 'full-session-id' };
    const entry = await appendTask(root, id, 'checkpoint', 'Evidence\nSecond line', session);
    assert.deepEqual(entry.session, session);
    assert.match(entry.ts, /[+-]\d\d:\d\d$/);
    const before = await readTask(root, id);
    assert.deepEqual(before.entries, [entry]);
    const after = await updateCurrentState(root, id, 'Next: finish', before.content);
    assert.match(after.content, /## Description\nGoal/);
    assert.match(after.content, /## Current state\nNext: finish/);
    await assert.rejects(updateCurrentState(root, id, 'stale', before.content), /changed since/);
    assert.equal((await readTask(root, id)).entries[0].comment, 'Evidence\nSecond line');
    await assert.rejects(appendTask(root, id, 'delete', 'x', session), /Invalid entry type/);
    await assert.rejects(readTask(root, '../../outside'), /Invalid task ID/);
    await assert.rejects(createTask(undefined, id, 'x', 'y', 'z'), /PI_TASKS_ROOT/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('preserves later sections during state update', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pi-tasks-test-'));
  try {
    const id = '2026-11/2026-11-10-other';
    const created = await createTask(root, id, 'Other', 'Goal', 'Current');
    const file = join(root, 'tasks', `${id}.md`);
    const content = created.content + '\n## Conclusion\nKeep this.\n';
    await writeFile(file, content);
    await updateCurrentState(root, id, 'Changed', content);
    assert.match(await readFile(file, 'utf8'), /## Conclusion\nKeep this\./);
  } finally { await rm(root, { recursive: true, force: true }); }
});
