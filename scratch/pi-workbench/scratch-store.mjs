import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const maxBytes = 5 * 1024 * 1024;
export function createScratchStore(root) {
  let writes = Promise.resolve();
  function pathFor(key) {
    if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid session key');
    return join(root, `${key}.md`);
  }
  async function bytesFor(path) {
    const stat = await fs.lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Scratch must be a regular file');
    if (stat.size > maxBytes) throw new Error('Scratch exceeds the 5 MiB limit');
    const bytes = await fs.readFile(path);
    if (bytes.length > maxBytes || bytes.includes(0)) throw new Error('Scratch is not supported text');
    let content;
    try { content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { throw new Error('Scratch is not valid UTF-8'); }
    if (/\r(?!\n)/.test(content) || (/\r\n/.test(content) && /(?<!\r)\n/.test(content))) throw new Error('Scratch has mixed or unsupported line endings');
    return { bytes, content };
  }
  async function read(key) {
    const path = pathFor(key);
    await fs.mkdir(root, { recursive: true, mode: 0o700 });
    const rootStat = await fs.lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Scratch directory must not be a symbolic link');
    try { const file = await fs.open(path, 'wx', 0o600); await file.close(); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    const { bytes, content } = await bytesFor(path);
    return { path, content, version: hash(bytes), lineEnding: content.includes('\r\n') ? 'crlf' : 'lf' };
  }
  function save(key, content, version) {
    const task = writes.then(async () => {
      const path = pathFor(key);
      if (typeof content !== 'string' || typeof version !== 'string') throw new Error('Invalid scratch save');
      const { bytes } = await bytesFor(path);
      if (hash(bytes) !== version) { const error = new Error('Scratch changed on disk. Your edits are preserved; copy them before reloading.'); error.status = 409; throw error; }
      const next = Buffer.from(content, 'utf8');
      if (next.length > maxBytes || next.includes(0)) throw new Error('Scratch is not supported text');
      if (/\r(?!\n)/.test(content) || (/\r\n/.test(content) && /(?<!\r)\n/.test(content))) throw new Error('Scratch has mixed or unsupported line endings');
      if (!bytes.equals(next)) await fs.writeFile(path, next);
      return { version: hash(next) };
    });
    writes = task.catch(() => {}); return task;
  }
  return { read, save, pathFor };
}
