import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

// Workbench-owned presentation metadata; never modifies Pi's session files.
export function createArchiveStore(stateDir) {
  const path = join(stateDir, 'archived-sessions.json');
  const lockPath = join(stateDir, 'archive-lock');
  async function read() {
    let raw;
    try {
      const info = await fs.lstat(path);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error('Archive metadata is not a regular file');
      raw = await fs.readFile(path, 'utf8');
    } catch (error) { if (error.code === 'ENOENT') return { raw: null, entries: {} }; throw error; }
    let parsed;
    try { parsed = JSON.parse(raw); } catch { throw new Error('Archive metadata is invalid; preserve it and inspect before retrying'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.version !== 1 || Object.keys(parsed).some((key) => !['version', 'archived'].includes(key)) || !parsed.archived || typeof parsed.archived !== 'object' || Array.isArray(parsed.archived)) throw new Error('Archive metadata has an unsupported format; preserve it and inspect before retrying');
    for (const [key, value] of Object.entries(parsed.archived)) {
      if (!/^[a-f0-9]{64}$/.test(key) || typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Archive metadata has invalid entries; preserve it and inspect before retrying');
    }
    return { raw, entries: parsed.archived };
  }
  async function list() { return (await read()).entries; }
  async function set(key, archived) {
    if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key) || typeof archived !== 'boolean') throw new Error('Invalid archive request');
    await fs.mkdir(stateDir, { recursive: true, mode: 0o700 });
    const owner = randomUUID();
    try { await fs.mkdir(lockPath, { mode: 0o700 }); }
    catch (error) { if (error.code === 'EEXIST') throw new Error('Archive metadata is in use or has a stale lock; inspect it before recovery'); throw error; }
    try {
      await fs.writeFile(join(lockPath, 'owner.json'), JSON.stringify({ owner, pid: process.pid, created: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
    } catch (error) { await fs.rmdir(lockPath).catch(() => {}); throw error; }
    try {
      const previous = await read();
      if (archived === Object.hasOwn(previous.entries, key)) return;
      const entries = { ...previous.entries };
      if (archived) entries[key] = new Date().toISOString(); else delete entries[key];
      const temporary = join(stateDir, `.archived-sessions.${owner}.tmp`);
      const file = await fs.open(temporary, 'wx', 0o600);
      try { await file.writeFile(`${JSON.stringify({ version: 1, archived: entries }, null, 2)}\n`); await file.sync(); }
      finally { await file.close(); }
      if ((await read()).raw !== previous.raw) throw new Error('Archive metadata changed; preserve the temporary file and inspect before retrying');
      await fs.rename(temporary, path);
    } finally {
      const lock = JSON.parse(await fs.readFile(join(lockPath, 'owner.json'), 'utf8'));
      if (lock.owner !== owner) throw new Error('Archive lock ownership changed; not removing it');
      await fs.unlink(join(lockPath, 'owner.json')); await fs.rmdir(lockPath);
    }
  }
  return { list, set };
}
