import { Type } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { createTask, readTask, appendTask, updateCurrentState, listOpenTasks } from './store.mjs';

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: 'pi_tasks', label: 'Experimental tasks',
    description: 'Manage experimental task records in the explicitly configured PI_TASKS_ROOT. Never use for existing .llm records. Actions: create, read, list, append, update_state. Logs are append-only.',
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
        case 'create': result = await createTask(root, task(), args.title, args.description, args.currentState); break;
        case 'update_state': result = await updateCurrentState(root, task(), args.currentState, args.expectedContent); break;
        case 'append': {
          const sessionId = ctx.sessionManager.getSessionId();
          if (!sessionId) throw new Error('Cannot attribute entry: no Pi session ID');
          result = await appendTask(root, task(), args.type, args.comment, { harness: 'pi', id: sessionId });
          break;
        }
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], details: undefined };
    },
  });
}
