import { Type } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createTaskWithDay, readTask, appendTask, updateCurrentState, closeTask, listOpenTasks, openDay, appendDay } from './store.mjs';

export default function (pi: ExtensionAPI) {
  const sessionFor = (ctx: { sessionManager: { getSessionId(): string } }) => {
    const id = ctx.sessionManager.getSessionId();
    if (!id) throw new Error('Cannot attribute entry: no Pi session ID');
    return { harness: 'pi', id };
  };
  pi.registerTool({
    name: 'day_open', label: 'Open day',
    description: 'Read the experimental day log for a local date (YYYY-MM-DD), or today if omitted. A missing day returns no entries and is not created.',
    parameters: Type.Object({ date: Type.Optional(Type.String({ description: 'Local date: YYYY-MM-DD' })) }),
    async execute(_id, args) {
      const result = await openDay(process.env.PI_TASKS_ROOT, args.date);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], details: undefined };
    },
  });
  pi.registerTool({
    name: 'day_append', label: 'Append day entry',
    description: 'Append an attributed entry to today’s experimental day log. Do not blindly retry after a failed or uncertain append; inspect the day first.',
    parameters: Type.Object({
      type: Type.Union([Type.Literal('task_open'), Type.Literal('task_reopen'), Type.Literal('task_close'), Type.Literal('decision'), Type.Literal('outcome'), Type.Literal('blocker'), Type.Literal('note')]),
      comment: Type.String(), task: Type.Optional(Type.String({ description: 'Optional task ID: YYYY-MM/YYYY-MM-DD-slug' })),
    }),
    async execute(_id, args, _signal, _update, ctx) {
      const result = await appendDay(process.env.PI_TASKS_ROOT, args.type, args.comment, sessionFor(ctx), args.task);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], details: undefined };
    },
  });
  const taskId = Type.String({ description: 'Task ID: YYYY-MM/YYYY-MM-DD-slug' });
  const output = (result: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }], details: undefined });

  pi.registerTool({
    name: 'task_create', label: 'Create task',
    description: 'Create an experimental task and append a task_open day entry. If the day append fails, inspect the day and do not recreate the task or retry blindly.',
    parameters: Type.Object({ id: taskId, title: Type.String(), description: Type.String(), currentState: Type.String() }),
    async execute(_id, args, _signal, _update, ctx) {
      const created = await createTaskWithDay(process.env.PI_TASKS_ROOT, args.id, args.title, args.description, args.currentState, sessionFor(ctx));
      return { ...output(created), ...(created.day.status === 'appended' ? {} : { isError: true }) };
    },
  });
  pi.registerTool({
    name: 'task_read', label: 'Read task',
    description: 'Read an experimental task anchor and its working log.',
    parameters: Type.Object({ id: taskId }),
    async execute(_id, args) { return output(await readTask(process.env.PI_TASKS_ROOT, args.id)); },
  });
  pi.registerTool({
    name: 'task_list', label: 'List tasks',
    description: 'List active and blocked experimental tasks.',
    parameters: Type.Object({}),
    async execute() { return output(await listOpenTasks(process.env.PI_TASKS_ROOT)); },
  });
  pi.registerTool({
    name: 'task_append', label: 'Append task entry',
    description: 'Append a session-attributed entry to an experimental task log. Do not blindly retry a failed or uncertain append; inspect the log first.',
    parameters: Type.Object({
      id: taskId,
      type: Type.Union([Type.Literal('note'), Type.Literal('attempt'), Type.Literal('decision'), Type.Literal('blocker'), Type.Literal('evidence'), Type.Literal('checkpoint'), Type.Literal('resume'), Type.Literal('handoff'), Type.Literal('correction')]),
      comment: Type.String(),
    }),
    async execute(_id, args, _signal, _update, ctx) {
      return output(await appendTask(process.env.PI_TASKS_ROOT, args.id, args.type, args.comment, sessionFor(ctx)));
    },
  });
  pi.registerTool({
    name: 'task_close', label: 'Close task',
    description: 'Close an experimental task as done or dropped and record a minimal day entry. If the day append fails, inspect the day and do not reopen or retry blindly.',
    parameters: Type.Object({ id: taskId, status: Type.Union([Type.Literal('done'), Type.Literal('dropped')]), conclusion: Type.String(), expectedContent: Type.String({ description: 'Exact task anchor content from task_read' }) }),
    async execute(_id, args, _signal, _update, ctx) {
      const closed = await closeTask(process.env.PI_TASKS_ROOT, args.id, args.status, args.conclusion, args.expectedContent, sessionFor(ctx));
      return { ...output(closed), ...(closed.day.status === 'appended' ? {} : { isError: true }) };
    },
  });
  pi.registerTool({
    name: 'task_update_state', label: 'Update task state',
    description: 'Update an experimental task current state, using exact content returned by task_read as the conflict check.',
    parameters: Type.Object({ id: taskId, currentState: Type.String(), expectedContent: Type.String({ description: 'Exact task anchor content from task_read' }) }),
    async execute(_id, args) {
      return output(await updateCurrentState(process.env.PI_TASKS_ROOT, args.id, args.currentState, args.expectedContent));
    },
  });
}
