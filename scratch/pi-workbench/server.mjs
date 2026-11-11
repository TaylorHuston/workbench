import { createServer } from 'node:http';
import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

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
  return { list, read, save, inspect, create, rename, remove };
}

export function createServerFor(workbench) {
  return createServer(async (req, res) => {
    const expectedHost = `127.0.0.1:${req.socket.localPort}`;
    if (req.headers.host !== expectedHost || (req.headers.origin && req.headers.origin !== `http://${expectedHost}`)) return json(res, 403, { error: 'Origin not allowed' });
    const url = new URL(req.url, `http://${expectedHost}`);
    try {
      if (req.method === 'GET' && url.pathname === '/api/list') return json(res, 200, await workbench.list(url.searchParams.get('path') ?? ''));
      if (req.method === 'GET' && url.pathname === '/api/file') return json(res, 200, await workbench.read(url.searchParams.get('path') ?? ''));
      if (req.method === 'GET' && url.pathname === '/api/entry') return json(res, 200, await workbench.inspect(url.searchParams.get('path') ?? '', url.searchParams.get('kind')));
      if (req.method === 'POST' && (url.pathname === '/api/file' || url.pathname === '/api/entry')) {
        if (req.headers.origin !== `http://${expectedHost}` || !req.headers['content-type']?.startsWith('application/json')) return json(res, 403, { error: 'Origin not allowed' });
        req.setEncoding('utf8');
        let data = ''; for await (const chunk of req) { data += chunk; if (data.length > 10_000_000) return json(res, 413, { error: 'File too large' }); }
        const { path, content, version, action, parent, name, kind } = JSON.parse(data);
        if (url.pathname === '/api/file') return json(res, 200, await workbench.save(path, content, version));
        if (action === 'create') return json(res, 200, await workbench.create(parent, name, kind));
        if (action === 'rename') return json(res, 200, await workbench.rename(path, kind, name, version));
        if (action === 'trash') return json(res, 200, await workbench.remove(path, kind, version));
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
  createServerFor(workbench).listen(port, '127.0.0.1', () => console.log(`Pi Workbench: http://127.0.0.1:${port}`));
}
