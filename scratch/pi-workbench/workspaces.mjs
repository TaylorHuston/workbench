import { promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { basename, isAbsolute, join } from 'node:path';

// Workbench-local presentation metadata; never changes a workspace or its Pi sessions.
export function createWorkspaceStore(stateDir) {
  const dir = join(stateDir, 'workspaces');
  const hash = (value) => createHash('sha256').update(value).digest('hex');
  const keyFor = (path) => hash(path);
  function validName(name) { return typeof name === 'string' && !!name.trim() && name === name.trim() && name.length <= 120 && !/[\r\n]/.test(name); }
  function nameFor(path) { return (basename(path).replace(/[\r\n]+/g, ' ').trim().slice(0, 120) || (path === '/' ? '/' : 'Workspace')); }
  async function read(name) {
    const path = join(dir, name), info = await fs.lstat(path);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('Workspace metadata is not a regular file; inspect it before recovery');
    const raw = await fs.readFile(path, 'utf8'); let entry;
    try { entry = JSON.parse(raw); } catch { throw new Error('Workspace metadata is invalid; preserve it and inspect before recovery'); }
    const common = entry && typeof entry === 'object' && !Array.isArray(entry) && typeof entry.path === 'string' && isAbsolute(entry.path) && name === `${keyFor(entry.path)}.json`;
    const legacy = common && entry.version === 1 && Object.keys(entry).every((key) => ['version', 'path'].includes(key));
    const current = common && entry.version === 2 && Object.keys(entry).every((key) => ['version', 'path', 'name', 'archived'].includes(key)) && validName(entry.name) && typeof entry.archived === 'boolean';
    if (!legacy && !current) throw new Error('Workspace metadata is invalid; preserve it and inspect before recovery');
    return { raw, record: { path: entry.path, name: legacy ? nameFor(entry.path) : entry.name, archived: legacy ? false : entry.archived, revision: hash(raw) } };
  }
  async function list() {
    let entries;
    try { entries = await fs.readdir(dir); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    const records = [];
    for (const name of entries.filter((item) => item.endsWith('.json')).sort()) records.push((await read(name)).record);
    return records;
  }
  async function add(path, requestedName) {
    if (typeof path !== 'string' || !isAbsolute(path)) throw new Error('Enter an absolute working directory');
    const canonical = await fs.realpath(path);
    if (!(await fs.stat(canonical)).isDirectory()) throw new Error('Workspace must be an existing folder');
    const displayName = requestedName === undefined ? nameFor(canonical) : typeof requestedName === 'string' ? requestedName.trim() : requestedName;
    if (!validName(displayName)) throw new Error('Workspace name must be 1–120 characters on one line');
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const name = `${keyFor(canonical)}.json`, temporary = join(dir, `.${randomUUID()}.tmp`);
    const raw = `${JSON.stringify({ version: 2, path: canonical, name: displayName, archived: false })}\n`;
    try {
      const file = await fs.open(temporary, 'wx', 0o600);
      try { await file.writeFile(raw); await file.sync(); } finally { await file.close(); }
      try { await fs.link(temporary, join(dir, name)); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        if ((await read(name)).record.path !== canonical) throw new Error('Workspace registration conflicts with existing metadata');
      }
      await fs.unlink(temporary);
      return (await read(name)).record;
    } catch (error) { throw new Error(`Workspace registration failed or is uncertain; inspect before retrying. ${error.message}`); }
  }
  async function update(path, changes, expectedRevision) {
    if (typeof path !== 'string' || !isAbsolute(path) || !changes || typeof changes !== 'object' || Array.isArray(changes) || !Object.keys(changes).length || Object.keys(changes).some((key) => !['name', 'archived'].includes(key)) || typeof expectedRevision !== 'string' || !/^[a-f0-9]{64}$/.test(expectedRevision)) throw new Error('Invalid workspace update');
    if ('name' in changes && (typeof changes.name !== 'string' || !validName(changes.name.trim()))) throw new Error('Workspace name must be 1–120 characters on one line');
    if ('archived' in changes && typeof changes.archived !== 'boolean') throw new Error('Invalid workspace archive state');
    const key = keyFor(path), name = `${key}.json`, lockPath = join(dir, `${key}.lock`), owner = randomUUID();
    try { await fs.mkdir(lockPath, { mode: 0o700 }); }
    catch (error) { if (error.code === 'EEXIST') throw new Error('Workspace metadata is in use or has a stale lock; inspect it before recovery'); throw error; }
    try { await fs.writeFile(join(lockPath, 'owner.json'), JSON.stringify({ owner, pid: process.pid }), { flag: 'wx', mode: 0o600 }); }
    catch (error) { await fs.rmdir(lockPath).catch(() => {}); throw error; }
    try {
      const before = await read(name);
      if (before.record.path !== path || before.record.revision !== expectedRevision) throw new Error('Workspace changed; refresh before updating it');
      const next = { version: 2, path, name: 'name' in changes ? changes.name.trim() : before.record.name, archived: 'archived' in changes ? changes.archived : before.record.archived };
      const raw = `${JSON.stringify(next)}\n`, temporary = join(dir, `.${owner}.tmp`);
      const file = await fs.open(temporary, 'wx', 0o600);
      try { await file.writeFile(raw); await file.sync(); } finally { await file.close(); }
      if ((await read(name)).raw !== before.raw) throw new Error('Workspace changed; preserve temporary metadata and inspect before retrying');
      await fs.rename(temporary, join(dir, name));
      return { path, name: next.name, archived: next.archived, revision: hash(raw) };
    } finally {
      const lock = JSON.parse(await fs.readFile(join(lockPath, 'owner.json'), 'utf8'));
      if (lock.owner !== owner) throw new Error('Workspace lock ownership changed; not removing it');
      await fs.unlink(join(lockPath, 'owner.json')); await fs.rmdir(lockPath);
    }
  }
  return { list, add, update };
}
