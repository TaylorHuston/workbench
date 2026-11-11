import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createAgentHost } from './agent.mjs';

const appDir = dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);
async function macTrash(path) {
  if (process.platform !== 'darwin') throw new Error('Moving to Trash requires macOS');
  await execFileAsync('/usr/bin/trash', ['-s', path]);
}
async function macRename(source, destination) {
  if (process.platform !== 'darwin') throw new Error('Renaming requires macOS');
  const script = 'ObjC.import("Foundation"); function run(argv) { if (!$.NSFileManager.defaultManager.moveItemAtPathToPathError($(argv[0]), $(argv[1]), null)) throw Error("Rename failed; check source and destination"); }';
  await execFileAsync('/usr/bin/osascript', ['-l', 'JavaScript', '-e', script, source, destination]);
}
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)); };

export async function createWorkbench(root, { trash = macTrash, move = macRename } = {}) {
  const base = await fs.realpath(root);
  let writes = Promise.resolve();
  async function checked(path, kind) {
    if (typeof path !== 'string' || path.includes('\0') || path.startsWith('/') || path.split('/').some((part) => part === '..' || part === '.')) throw new Error('Invalid path');
    const parts = path ? path.split('/') : [];
    if (parts.some((part) => !part)) throw new Error('Invalid path');
    let current = base;
    for (const part of parts) {
      current = join(current, part);
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new Error('Symbolic links are not supported');
    }
    const actual = await fs.realpath(current);
    if (actual !== base && !actual.startsWith(base + sep)) throw new Error('Path outside root');
    const stat = await fs.stat(actual);
    if (kind === 'directory' && !stat.isDirectory()) throw new Error('Not a directory');
    if (kind === 'file' && (!stat.isFile() || !path.toLowerCase().endsWith('.md'))) throw new Error('Not a Markdown file');
    return actual;
  }
  async function list(path) {
    const dir = await checked(path, 'directory');
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((entry) => !entry.isSymbolicLink() && (entry.isDirectory() || (entry.isFile() && entry.name.toLowerCase().endsWith('.md'))))
      .map((entry) => ({ name: entry.name, path: path ? `${path}/${entry.name}` : entry.name, type: entry.isDirectory() ? 'directory' : 'file' }))
      .sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1);
  }
  async function read(path) {
    const file = await checked(path, 'file');
    const bytes = await fs.readFile(file);
    const content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    if (/\r(?!\n)/.test(content) || (/\r\n/.test(content) && /(?<!\r)\n/.test(content))) throw new Error('Mixed or unsupported line endings; open this file elsewhere');
    return { content, version: hash(bytes), lineEnding: content.includes('\r\n') ? 'crlf' : 'lf' };
  }
  function serialize(action) {
    const operation = writes.then(action);
    writes = operation.catch(() => {});
    return operation;
  }
  function save(path, content, version) {
    return serialize(async () => {
      if (typeof content !== 'string' || typeof version !== 'string') throw new Error('Invalid save');
      const file = await checked(path, 'file');
      const before = await fs.readFile(file);
      if (hash(before) !== version) { const e = new Error('File changed on disk. Copy your changes, then reopen it.'); e.status = 409; throw e; }
      const bytes = Buffer.from(content, 'utf8');
      if (!before.equals(bytes)) await fs.writeFile(file, bytes);
      return { version: hash(bytes) };
    });
  }
  function validateName(name, kind) {
    if (typeof name !== 'string' || !name.trim() || name === '.' || name === '..' || /[\/\\\0]/.test(name)) throw new Error('Enter a single valid name');
    if (kind === 'file' && !name.toLowerCase().endsWith('.md')) throw new Error('Markdown filenames must end in .md');
  }
  async function inspect(path, kind) {
    if (!path || !['file', 'directory'].includes(kind)) throw new Error('Choose a file or folder');
    const file = await checked(path, kind);
    const stat = await fs.stat(file, { bigint: true });
    const identity = `${stat.dev}:${stat.ino}:${stat.mtimeNs}:${stat.size}`;
    const version = kind === 'file' ? `${identity}:${hash(await fs.readFile(file))}` : identity;
    return { version };
  }
  function create(parent, name, kind) {
    return serialize(async () => {
      if (!['file', 'directory'].includes(kind)) throw new Error('Invalid item type');
      validateName(name, kind);
      const folder = await checked(parent, 'directory');
      const destination = join(folder, name);
      if (kind === 'file') await fs.writeFile(destination, '', { flag: 'wx' });
      else await fs.mkdir(destination);
      return { path: parent ? `${parent}/${name}` : name };
    });
  }
  function rename(path, kind, name, version) {
    return serialize(async () => {
      if (!['file', 'directory'].includes(kind)) throw new Error('Invalid item type');
      validateName(name, kind);
      const current = await inspect(path, kind);
      if (typeof version !== 'string' || current.version !== version) throw new Error('Item changed; refresh and try again');
      const file = await checked(path, kind);
      const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      const destination = join(await checked(parent, 'directory'), name);
      if (file === destination) return { path };
      try { await fs.lstat(destination); throw new Error('An item with that name already exists'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      try { await move(file, destination); } catch (error) { throw new Error(`Rename failed or is uncertain; inspect both names before retrying. ${error.message}`); }
      return { path: parent ? `${parent}/${name}` : name };
    });
  }
  function remove(path, kind, version) {
    return serialize(async () => {
      const current = await inspect(path, kind);
      if (typeof version !== 'string' || current.version !== version) throw new Error('Item changed; refresh and try again');
      const file = await checked(path, kind);
      if (kind === 'directory' && (await fs.readdir(file)).length) throw new Error('Only empty folders can be moved to Trash');
      try { await trash(file); } catch (error) { throw new Error(`Trash operation failed or is uncertain; inspect the folder and Trash before retrying. ${error.message}`); }
      return { ok: true };
    });
  }
  return { root: base, list, read, save, inspect, create, rename, remove };
}

export function createServerFor(workbench, agent, { createWorkspace = createWorkbench } = {}) {
  const roots = new Map([[workbench.root, Promise.resolve(workbench)]]);
  let writes = Promise.resolve();
  const serialize = (action) => { const operation = writes.then(action); writes = operation.catch(() => {}); return operation; };
  async function workspace(path) {
    if (path == null || path === workbench.root) return workbench;
    if (typeof path !== 'string' || !isAbsolute(path)) throw new Error('Invalid workspace');
    const canonical = await fs.realpath(path);
    if (!(await fs.stat(canonical)).isDirectory()) throw new Error('Workspace must be an existing folder');
    if (!roots.has(canonical)) roots.set(canonical, createWorkspace(canonical));
    const pending = roots.get(canonical);
    try { return await pending; }
    catch (error) { if (roots.get(canonical) === pending) roots.delete(canonical); throw error; }
  }
  return createServer(async (req, res) => {
    const expectedHost = `127.0.0.1:${req.socket.localPort}`;
    if (req.headers.host !== expectedHost || (req.headers.origin && req.headers.origin !== `http://${expectedHost}`)) return json(res, 403, { error: 'Origin not allowed' });
    const url = new URL(req.url, `http://${expectedHost}`);
    try {
      if (req.method === 'GET' && url.pathname === '/api/workspace-root') {
        const piRoot = await fs.realpath(join(homedir(), '.pi')).catch(() => null);
        return json(res, 200, { root: workbench.root, label: workbench.root === piRoot ? '~/.pi' : workbench.root });
      }
      if (agent && req.method === 'GET' && url.pathname === '/api/agent/state') return json(res, 200, agent.snapshot());
      if (agent && req.method === 'GET' && url.pathname === '/api/agent/sessions') return json(res, 200, await agent.list());
      if (agent && req.method === 'GET' && url.pathname === '/api/agent/workspaces') return json(res, 200, await agent.listWorkspaces());
      if (agent && req.method === 'GET' && url.pathname === '/api/agent/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Content-Type-Options': 'nosniff' });
        const unsubscribe = agent.subscribe((event) => res.write(`data: ${JSON.stringify(event)}\n\n`));
        req.on('close', unsubscribe); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/list') return json(res, 200, await (await workspace(url.searchParams.get('workspace'))).list(url.searchParams.get('path') ?? ''));
      if (req.method === 'GET' && url.pathname === '/api/file') return json(res, 200, await (await workspace(url.searchParams.get('workspace'))).read(url.searchParams.get('path') ?? ''));
      if (req.method === 'GET' && url.pathname === '/api/entry') return json(res, 200, await (await workspace(url.searchParams.get('workspace'))).inspect(url.searchParams.get('path') ?? '', url.searchParams.get('kind')));
      if (req.method === 'POST' && (url.pathname === '/api/file' || url.pathname === '/api/entry' || (agent && url.pathname.startsWith('/api/agent/')))) {
        if (req.headers.origin !== `http://${expectedHost}` || !req.headers['content-type']?.startsWith('application/json')) return json(res, 403, { error: 'Origin not allowed' });
        req.setEncoding('utf8');
        let data = ''; for await (const chunk of req) { data += chunk; if (data.length > 10_000_000) return json(res, 413, { error: 'File too large' }); }
        const { path, content, version, action, parent, name, kind, key, message, archived, cwd, changes, revision, id, value, workspace: workspacePath } = JSON.parse(data);
        if (url.pathname === '/api/agent/dialog') { agent.respondDialog(id, value); return json(res, 200, { ok: true }); }
        if (url.pathname === '/api/agent/workspaces') {
          if (typeof cwd !== 'string' || !isAbsolute(cwd)) throw new Error('Enter an absolute working directory');
          if (action === 'update') {
            if (cwd === workbench.root) throw new Error('The default workspace cannot be changed');
            return json(res, 200, await agent.updateWorkspace(cwd, changes, revision));
          }
          if (action !== undefined && action !== 'add') throw new Error('Invalid workspace action');
          if (await fs.realpath(cwd) === workbench.root) throw new Error('The default workspace is already available');
          return json(res, 200, await agent.addWorkspace(cwd, name));
        }
        if (url.pathname === '/api/agent/new') return json(res, 200, await agent.createSession(cwd));
        if (url.pathname === '/api/agent/archive') return json(res, 200, await agent.setArchived(key, archived));
        if (url.pathname === '/api/agent/open') return json(res, 200, await agent.open(key));
        if (['/api/agent/close', '/api/agent/reload', '/api/agent/send', '/api/agent/stop'].includes(url.pathname) && (typeof key !== 'string' || agent.snapshot()?.key !== key)) throw new Error('Session changed; review the active session before retrying');
        if (url.pathname === '/api/agent/reload') return json(res, 200, await agent.reload(key));
        if (url.pathname === '/api/agent/close') { await agent.close(); return json(res, 200, { ok: true }); }
        if (url.pathname === '/api/agent/send') return json(res, 200, agent.send(message));
        if (url.pathname === '/api/agent/stop') { await agent.stop(); return json(res, 200, { ok: true }); }
        if (url.pathname.startsWith('/api/agent/')) return json(res, 404, { error: 'Not found' });
        const store = await workspace(workspacePath);
        if (url.pathname === '/api/file') return json(res, 200, await serialize(() => store.save(path, content, version)));
        if (action === 'create') return json(res, 200, await serialize(() => store.create(parent, name, kind)));
        if (action === 'rename') return json(res, 200, await serialize(() => store.rename(path, kind, name, version)));
        if (action === 'trash') return json(res, 200, await serialize(() => store.remove(path, kind, version)));
        throw new Error('Invalid action');
      }
      if (req.method !== 'GET') return json(res, 404, { error: 'Not found' });
      const asset = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!/^(index\.html|assets\/[\w.-]+)$/.test(asset)) return json(res, 404, { error: 'Not found' });
      const bytes = await fs.readFile(join(appDir, 'dist', asset));
      const type = asset.endsWith('.js') ? 'text/javascript' : asset.endsWith('.css') ? 'text/css' : 'text/html';
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'" }); res.end(bytes);
    } catch (error) { json(res, error.status ?? 400, { error: error.message }); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = process.env.PI_WORKBENCH_ROOT || join(homedir(), '.pi');
  const port = Number(process.env.PORT || 4175);
  const workbench = await createWorkbench(root);
  const agent = createAgentHost();
  const server = createServerFor(workbench, agent);
  server.listen(port, '127.0.0.1', () => console.log(`Pi Workbench: http://127.0.0.1:${port}`));
  let shuttingDown = false;
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    try { await agent.stop(); await agent.close(); }
    catch (error) { console.error(`Agent shutdown incomplete; inspect session locks: ${error.message}`); }
    finally { server.close(); server.closeAllConnections(); }
  };
  process.once('SIGINT', () => { void shutdown(); });
  process.once('SIGTERM', () => { void shutdown(); });
}
