import { writeFile } from 'node:fs/promises';
import { createServerFor, createWorkbench } from './server.mjs';

// Disposable browser-test server: no real sessions, extensions, MCP, or model calls.
const agent = {
  snapshot: () => null,
  listWorkspaces: async () => [],
  list: async () => [],
  subscribe: (listener) => { listener({ type: 'snapshot', value: null }); return () => {}; },
};
const server = createServerFor(await createWorkbench(process.env.FIXTURE_ROOT), agent);
server.listen(0, '127.0.0.1', async () => { await writeFile(process.env.PORT_FILE, String(server.address().port)); });
process.on('SIGTERM', () => { server.close(); server.closeAllConnections(); });
