import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTask, createTaskWithDay, readTask, appendTask, updateCurrentState, listOpenTasks, openDay, appendDay } from './store.mjs';

test('day read, append, attribution and task-open recording', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pi-tasks-day-test-'));
  try {
    assert.deepEqual(await openDay(root, '2026-11-10'), { date: '2026-11-10', entries: [] });
    await assert.rejects(stat(join(root, 'days')), { code: 'ENOENT' });
    const session = { harness: 'pi', id: 'full-session-id' };
    const when = new Date(2026, 10, 10, 12, 34, 56);
    const id = '2026-11/2026-11-10-test';
    const created = await createTaskWithDay(root, id, 'Test', 'Goal', 'Next: test', session, when);
    assert.equal(created.day.status, 'appended');
    assert.equal(created.day.entry.type, 'task_open');
    assert.equal(created.day.entry.task, id);
    const standalone = await appendDay(root, 'note', 'A standalone note', session, undefined, when);
    assert.equal('task' in standalone, false);
    assert.deepEqual((await openDay(root, '2026-11-10')).entries, [created.day.entry, standalone]);
    await assert.rejects(appendDay(root, 'unknown', 'bad', session), /Invalid day entry type/);
    await assert.rejects(appendDay(root, 'note', 'bad', session, '../../escape'), /Invalid task ID/);
    await assert.rejects(openDay(root, '2026-02-30'), /Invalid calendar date/);
    await assert.rejects(openDay(root, '../outside'), /Invalid day/);
    await writeFile(join(root, 'days', '2026-11-09.jsonl'), '{broken');
    await assert.rejects(openDay(root, '2026-11-09'), /Invalid day log entry at line 1/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('task creation reports uncertain day write without recreating task', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pi-tasks-partial-test-'));
  try {
    await writeFile(join(root, 'days'), 'blocks day directory');
    const id = '2026-11/2026-11-10-partial';
    const result = await createTaskWithDay(root, id, 'Partial', 'Goal', 'Next', { harness: 'pi', id: 'session' }, new Date(2026, 10, 10, 12));
    assert.equal(result.day.status, 'uncertain');
    assert.equal(result.day.date, '2026-11-10');
    assert.equal(result.day.intendedEntry.task, id);
    assert.equal(result.day.intendedEntry.session.id, 'session');
    assert.match(result.day.message, /do not recreate.*retry blindly/);
    assert.equal((await readTask(root, id)).content, result.task.content);
    await assert.rejects(createTaskWithDay(root, id, 'Partial', 'Goal', 'Next', { harness: 'pi', id: 'session' }), { code: 'EEXIST' });
    const absent = '2026-11/2026-11-10-no-session';
    await assert.rejects(createTaskWithDay(root, absent, 'No session', 'Goal', 'Next', undefined), /attribution/);
    await assert.rejects(stat(join(root, 'tasks', `${absent}.md`)), { code: 'ENOENT' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

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
