import { randomUUID } from 'node:crypto';

// In-memory requests are never replayed after restart. A disconnected viewer cannot approve them.
export function createExtensionDialogs({ publish, hasViewers }) {
  const pending = new Map();
  function finish(id, result) {
    const item = pending.get(id); if (!item) return false;
    pending.delete(id); clearTimeout(item.timer); item.signal?.removeEventListener('abort', item.abort);
    publish({ type: 'extension_dialog_closed', id }); item.resolve(result); return true;
  }
  function request(kind, fields, opts = {}) {
    const cancelled = kind === 'confirm' ? false : undefined;
    if (!hasViewers() || opts.signal?.aborted) return Promise.resolve(cancelled);
    const id = randomUUID(), dialog = { id, kind, ...fields };
    return new Promise((resolve) => {
      const item = { dialog, resolve, signal: opts.signal, abort: () => finish(id, cancelled) };
      pending.set(id, item);
      if (opts.signal) opts.signal.addEventListener('abort', item.abort, { once: true });
      if (typeof opts.timeout === 'number' && Number.isFinite(opts.timeout)) item.timer = setTimeout(item.abort, Math.max(0, opts.timeout));
      if (opts.signal?.aborted) item.abort(); else publish({ type: 'extension_dialog', dialog });
    });
  }
  function respond(id, value) {
    const item = pending.get(id); if (!item) throw new Error('Dialog is no longer pending');
    const { kind, options } = item.dialog;
    if (value === null) return finish(id, kind === 'confirm' ? false : undefined);
    if (kind === 'confirm' ? typeof value !== 'boolean' : typeof value !== 'string' || value.length > 100000 || (kind === 'select' && !options.includes(value))) throw new Error('Invalid dialog response');
    return finish(id, value);
  }
  function cancelAll() { for (const [id, item] of [...pending]) finish(id, item.dialog.kind === 'confirm' ? false : undefined); }
  function replay(listener) { for (const { dialog } of pending.values()) listener({ type: 'extension_dialog', dialog }); }
  function context(base) {
    return {
      ...base,
      select: (title, options, opts) => request('select', { title, options }, opts),
      confirm: (title, message, opts) => request('confirm', { title, message }, opts),
      input: (title, placeholder, opts) => request('input', { title, placeholder }, opts),
      editor: (title, prefill) => request('editor', { title, prefill }),
      notify: (message, severity) => publish({ type: 'extension_notice', message, severity }),
      custom: async () => { throw new Error('Custom terminal extension UI is not supported in Workbench'); },
    };
  }
  return { context, respond, cancelAll, replay };
}
