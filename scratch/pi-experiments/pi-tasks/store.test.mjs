import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTask, createTaskWithDay, readTask, appendTask, updateCurrentState, closeTask, listOpenTasks, openDay, appendDay } from './store.mjs';

test('entry UUIDs are generated and duplicate IDs are refused per log', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pi-tasks-uuid-test-'));
  try {
    const id = '2026-11/2026-11-10-uuid';
    const session = { harness: 'pi', id: 'session' };
    const when = new Date(2026, 10, 10, 12);
    await createTask(root, id, 'UUID', 'Goal', 'Next');
    const first = await appendTask(root, id, 'note', 'First', session, when);
    const second = await appendTask(root, id, 'note', 'Second', session, when);
    assert.match(first.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.notEqual(first.id, second.id);
    await assert.rejects(appendTask(root, id, 'note', 'Duplicate', session, when, first.id), /Duplicate entry id/);
    await assert.rejects(appendTask(root, id, 'note', 'Bad id', session, when, 'not-a-uuid'), /UUID v4/);
    const day = await appendDay(root, 'note', 'Day', session, undefined, when);
    await assert.rejects(appendDay(root, 'note', 'Duplicate', session, undefined, when, day.id), /Duplicate entry id/);
    assert.equal((await readTask(root, id)).entries.length, 2);
    assert.equal((await openDay(root, '2026-11-10')).entries.length, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('legacy entries remain readable and incomplete or duplicate logs are not appended', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pi-tasks-legacy-test-'));
  try {
    const session = { harness: 'pi', id: 'session' };
    const when = new Date(2026, 10, 10, 12);
    await mkdir(join(root, 'days'));
    const file = join(root, 'days', '2026-11-10.jsonl');
    const legacy = { ts: '2026-11-10T12:00:00-05:00', session, type: 'note', comment: 'Legacy' };
    await writeFile(file, JSON.stringify(legacy) + '\n');
    assert.deepEqual((await openDay(root, '2026-11-10')).entries, [legacy]);
    const entry = await appendDay(root, 'note', 'New', session, undefined, when);
    assert.equal((await openDay(root, '2026-11-10')).entries.length, 2);
    const bytes = await readFile(file, 'utf8');
    await writeFile(file, bytes + JSON.stringify(entry) + '\n');
    await assert.rejects(appendDay(root, 'note', 'Blocked', session, undefined, when), /Duplicate entry id/);
    await writeFile(file, bytes.slice(0, -1));
    await assert.rejects(appendDay(root, 'note', 'Blocked', session, undefined, when), /missing final newline/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

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
    assert.match(result.day.intendedEntry.id, /^[0-9a-f-]{36}$/);
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

test('close records done or dropped with a minimal day entry and preserves history', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pi-tasks-close-test-'));
  try {
    const session = { harness: 'pi', id: 'closing-session' };
    const when = new Date(2026, 10, 10, 12);
    for (const status of ['done', 'dropped']) {
      const id = `2026-11/2026-11-10-${status}`;
      await createTask(root, id, `Task ${status}`, 'Original goal', 'Next: finish');
      await appendTask(root, id, 'note', 'Keep this history', session, when);
      const original = await readTask(root, id);
      await assert.rejects(closeTask(root, id, status, 'Conclusion', original.content + 'stale', session, when), /changed since/);
      await assert.rejects(closeTask(root, id, 'active', 'Conclusion', original.content, session, when), /Closure status/);
      const result = await closeTask(root, id, status, 'Result costs $& and $1.', original.content, session, when);
      assert.equal(result.day.status, 'appended');
      assert.match(result.task.content, new RegExp(`^status: ${status}`, 'm'));
      assert.match(result.task.content, /## Description\nOriginal goal/);
      assert.match(result.task.content, new RegExp(`## Current state\\nClosed \\(${status}\\)\\.`));
      assert.ok(result.task.content.includes('## Conclusion\nResult costs $& and $1.'));
      assert.equal(result.day.entry.comment, `Closed: Task ${status}`);
      assert.equal(result.day.entry.type, 'task_close');
      assert.equal(result.day.entry.task, id);
      assert.deepEqual(result.day.entry.session, session);
      assert.equal((await readTask(root, id)).entries[0].comment, 'Keep this history');
      await assert.rejects(closeTask(root, id, status, 'Again', result.task.content, session, when), /already closed/);
    }
    assert.equal((await openDay(root, '2026-11-10')).entries.length, 2);
    assert.deepEqual(await listOpenTasks(root), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('close reports uncertain day append and preserves closed task', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pi-tasks-close-partial-'));
  try {
    const id = '2026-11/2026-11-10-partial-close';
    const created = await createTask(root, id, 'Partial close', 'Goal', 'Next');
    await writeFile(join(root, 'days'), 'blocks day directory');
    const session = { harness: 'pi', id: 'closing-session' };
    const result = await closeTask(root, id, 'done', 'Finished', created.content, session, new Date(2026, 10, 10, 12));
    assert.equal(result.day.status, 'uncertain');
    assert.equal(result.day.date, '2026-11-10');
    assert.equal(result.day.intendedEntry.type, 'task_close');
    assert.match(result.day.intendedEntry.id, /^[0-9a-f-]{36}$/);
    assert.equal(result.day.intendedEntry.task, id);
    assert.match(result.day.message, /do not reopen.*retry blindly/);
    assert.equal((await readTask(root, id)).content, result.task.content);
    await assert.rejects(closeTask(root, id, 'done', 'Finished', result.task.content, session), /already closed/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('close refuses to overwrite an existing conclusion', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pi-tasks-conclusion-'));
  try {
    const id = '2026-11/2026-11-10-existing-conclusion';
    const created = await createTask(root, id, 'Existing', 'Goal', 'Next');
    const file = join(root, 'tasks', `${id}.md`);
    const content = created.content + '\n## Conclusion\nPrevious conclusion.\n';
    await writeFile(file, content);
    await assert.rejects(closeTask(root, id, 'done', 'New conclusion', content, { harness: 'pi', id: 'session' }), /already has a conclusion/);
    assert.equal(await readFile(file, 'utf8'), content);
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
