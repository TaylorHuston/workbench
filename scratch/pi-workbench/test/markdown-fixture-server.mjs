import { realpath, rename, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServerFor, createWorkbench } from './server.mjs';

// Disposable browser-test server: no real sessions, extensions, MCP, or model calls.
const other = process.env.OTHER_ROOT ? await realpath(process.env.OTHER_ROOT) : null;
const fixtureRoot = await realpath(process.env.FIXTURE_ROOT);
const keys = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
const fixtures = process.env.FIXTURE_SESSIONS ? keys.slice(0, 2).map((key, i) => ({ key, cwd: fixtureRoot, name: `Session ${i + 1}`, modified: new Date().toISOString(), archived: false })) : [];
let active = null; const listeners = new Set();
const emit = (event) => { for (const listener of listeners) listener(event); };
const publish = () => emit({ type: 'snapshot', value: active });
const chatFixture = '# Summary\n\n**Bold** and *italic* with `inline` and ~~removed~~.\n\n- First\n- [x] Second\n\n> A quote\n\n| Name | State |\n| --- | --- |\n| Item | Ready |\n\n```js\nconst value = 1;\n```\n\n[Safe](https://example.com/?a=1&amp;b=2) [Unsafe](javascript:alert(1)) [Encoded](jav&#x61;script&#58;alert(1)) ![Remote](https://example.com/image.png) <img src=x onerror="window.fixtureXss=true">';
const agent = {
  snapshot: () => active,
  listWorkspaces: async () => other ? [{ id: createHash('sha256').update(other).digest('hex'), path: other, name: 'Other workspace', archived: false, revision: 'fixture' }] : [],
  list: async () => fixtures,
  open: async (key) => { if (key === 'd'.repeat(64) || active?.key === key) throw new Error('Session is already in use or has a stale Workbench lock; inspect the lock before recovery'); const entry = fixtures.find(item => item.key === key); if (!entry) throw new Error('Session not found'); active = { ...entry, messages: process.env.FIXTURE_CHAT ? [{ role: 'user', text: '**Question** &amp; answer' }, { role: 'assistant', text: chatFixture }] : [], model: 'fixture', tools: [], busy: false, warning: '1 skill discovery warning(s). Global extensions are active. Basic dialogs are supported; custom terminal UI is not.' }; publish(); return active; },
  createSession: async () => { fixtures.push({ key: keys[2], cwd: fixtureRoot, name: 'New session', archived: false }); return agent.open(keys[2]); },
  rename: (key, name) => { const entry = fixtures.find(item => item.key === key); if (!entry || active?.key !== key) throw new Error('Session changed'); entry.name = name; return { name }; },
  reload: async key => { if (active?.key !== key) throw new Error('Session changed'); publish(); return active; },
  setArchived: async (key, archived) => { const entry = fixtures.find(item => item.key === key); if (!entry) throw new Error('Session not found'); entry.archived = archived; for (const listener of listeners) listener({ type: 'archives_changed', key, archived }); return { ok: true }; },
  send: (message, document) => {
    if (process.env.FIXTURE_CHAT && message === 'stream chat') {
      emit({ type: 'message', value: { role: 'user', text: message } });
      emit({ type: 'delta', text: '**Streaming**' });
      setTimeout(() => { emit({ type: 'delta', text: ' response' }); emit({ type: 'message', value: { role: 'assistant', text: '**Streaming** response' } }); }, 1800);
      return { accepted: true };
    }
    if (message !== 'fixture question' || document !== 'second.md') throw new Error('Unexpected fixture prompt context'); return { accepted: true };
  },
  subscribe: (listener) => { listeners.add(listener); if (process.env.FIXTURE_DELAY_SNAPSHOT) setTimeout(() => { if (listeners.has(listener)) listener({ type: 'snapshot', value: active }); }, 1200); else listener({ type: 'snapshot', value: active }); return () => listeners.delete(listener); },
};
const store = await createWorkbench(process.env.FIXTURE_ROOT, { move: rename });
if (process.env.DELAY_FILE) {
  const read = store.read;
  store.read = async (path) => { if (path === process.env.DELAY_FILE) await new Promise((resolve) => setTimeout(resolve, 800)); return read(path); };
}
const server = createServerFor(store, agent);
server.listen(0, '127.0.0.1', async () => { await writeFile(process.env.PORT_FILE, String(server.address().port)); });
process.on('SIGTERM', () => { server.close(); server.closeAllConnections(); });
