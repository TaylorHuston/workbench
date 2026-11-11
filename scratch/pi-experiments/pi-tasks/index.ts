import { Type } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createTaskWithDay, readTask, appendTask, updateCurrentState, listOpenTasks, openDay, appendDay } from './store.mjs';

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
  pi.registerTool({
    name: 'pi_tasks', label: 'Experimental tasks',
    description: 'Manage experimental task records in the explicitly configured PI_TASKS_ROOT. Never use for existing .llm records. Actions: create, read, list, append, update_state. Create also appends a day entry; if that fails, inspect the day and do not recreate the task or retry blindly. Logs are append-only.',
    parameters: Type.Object({
      action: Type.Union([Type.Literal('create'), Type.Literal('read'), Type.Literal('list'), Type.Literal('append'), Type.Literal('update_state')]),
      id: Type.Optional(Type.String({ description: 'Task ID: YYYY-MM/YYYY-MM-DD-slug' })),
      title: Type.Optional(Type.String()), description: Type.Optional(Type.String()),
      currentState: Type.Optional(Type.String()), expectedContent: Type.Optional(Type.String({ description: 'Exact task content from read, required for update_state' })),
      type: Type.Optional(Type.Union([Type.Literal('note'), Type.Literal('attempt'), Type.Literal('decision'), Type.Literal('blocker'), Type.Literal('evidence'), Type.Literal('checkpoint'), Type.Literal('resume'), Type.Literal('handoff'), Type.Literal('correction')])),
      comment: Type.Optional(Type.String()),
    }),
    async execute(_id, args, _signal, _update, ctx) {
      const root = process.env.PI_TASKS_ROOT;
      const task = () => { if (!args.id) throw new Error('id is required'); return args.id; };
      let result: unknown;
      switch (args.action) {
        case 'list': result = await listOpenTasks(root); break;
        case 'read': result = await readTask(root, task()); break;
        case 'create': {
          const created = await createTaskWithDay(root, task(), args.title, args.description, args.currentState, sessionFor(ctx));
          if (created.day.status !== 'appended') return { content: [{ type: 'text', text: JSON.stringify(created, null, 2) }], details: undefined, isError: true };
          result = created;
          break;
        }
        case 'update_state': result = await updateCurrentState(root, task(), args.currentState, args.expectedContent); break;
        case 'append': {
          result = await appendTask(root, task(), args.type, args.comment, sessionFor(ctx));
          break;
        }
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], details: undefined };
    },
  });
}
