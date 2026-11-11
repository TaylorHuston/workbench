import { appendFile, mkdir, open, readFile, readdir, stat } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { realpathSync } from 'node:fs';

const types = new Set(['note', 'attempt', 'decision', 'blocker', 'evidence', 'checkpoint', 'resume', 'handoff', 'correction']);
const statuses = new Set(['active', 'blocked', 'done', 'dropped']);

function rootPath(root) {
  if (!root || !isAbsolute(root)) throw new Error('PI_TASKS_ROOT must be an explicit absolute path to an isolated experimental store');
  const resolved = realpathSync(root);
  if (resolved.split('/').includes('.llm')) throw new Error('The experimental store cannot target .llm');
  return resolved;
}
function taskPath(root, id) {
  root = rootPath(root);
  if (!/^\d{4}-\d{2}\/\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || !id.startsWith(id.slice(0, 7) + '/' + id.slice(0, 7))) throw new Error('Invalid task ID');
  return join(root, 'tasks', id);
}
function nonempty(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}
function headingFree(value, name) {
  value = nonempty(value, name);
  if (/^#{1,2}\s/m.test(value)) throw new Error(`${name} cannot contain level 1 or 2 headings`);
  return value;
}
export async function createTask(root, id, title, description, currentState) {
  const base = taskPath(root, id);
  title = nonempty(title, 'title');
  if (/[\r\n]/.test(title)) throw new Error('title must be one line');
  description = headingFree(description, 'description');
  currentState = headingFree(currentState, 'currentState');
  await mkdir(join(base, '..'), { recursive: true });
  const content = `status: active\n\n# ${title}\n\n## Description\n${description}\n\n## Current state\n${currentState}\n`;
  const file = await open(`${base}.md`, 'wx');
  try { await file.writeFile(content, 'utf8'); } finally { await file.close(); }
  return { id, content };
}
export async function readTask(root, id) {
  const base = taskPath(root, id);
  const content = await readFile(`${base}.md`, 'utf8');
  let log;
  try { log = await readFile(`${base}.jsonl`, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; log = ''; }
  const entries = log.split('\n').filter(Boolean).map((line, i) => { try { return JSON.parse(line); } catch { throw new Error(`Invalid task log entry at line ${i + 1}`); } });
  return { id, content, entries };
}
export async function appendTask(root, id, type, comment, session, timestamp = new Date()) {
  const base = taskPath(root, id);
  if (!types.has(type)) throw new Error('Invalid entry type');
  comment = nonempty(comment, 'comment');
  if (!session || !session.harness || !session.id) throw new Error('Full session attribution is required');
  await stat(`${base}.md`);
  // Include the local UTC offset, rather than relying on UTC midnight for local records.
  const offset = -timestamp.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const pad = n => String(n).padStart(2, '0');
  const local = `${timestamp.getFullYear()}-${pad(timestamp.getMonth()+1)}-${pad(timestamp.getDate())}T${pad(timestamp.getHours())}:${pad(timestamp.getMinutes())}:${pad(timestamp.getSeconds())}${sign}${pad(Math.floor(Math.abs(offset)/60))}:${pad(Math.abs(offset)%60)}`;
  const entry = { ts: local, session, type, comment };
  await appendFile(`${base}.jsonl`, JSON.stringify(entry) + '\n', { encoding: 'utf8', mode: 0o600 });
  return entry;
}
export async function updateCurrentState(root, id, currentState, expectedContent) {
  const base = taskPath(root, id);
  currentState = headingFree(currentState, 'currentState');
  if (typeof expectedContent !== 'string') throw new Error('expectedContent from readTask is required');
  const file = await open(`${base}.md`, 'r+');
  try {
    const before = await file.readFile('utf8');
    if (before !== expectedContent) throw new Error('Task changed since it was read; read it again');
    const pattern = /(^## Current state[ \t]*\n)[\s\S]*?(?=^## |(?![\s\S]))/m;
    const match = before.match(pattern);
    if (!match) throw new Error('Expected a Current state section');
    const after = before.replace(pattern, `$1${currentState}\n\n`);
    await file.write(after, 0, 'utf8');
    await file.truncate(Buffer.byteLength(after));
    return { id, content: after };
  } finally { await file.close(); }
}
export async function listOpenTasks(root) {
  const dir = join(rootPath(root), 'tasks');
  let months; try { months = await readdir(dir, { withFileTypes: true }); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  const result = [];
  for (const month of months.filter(x => x.isDirectory() && /^\d{4}-\d{2}$/.test(x.name))) {
    for (const file of await readdir(join(dir, month.name), { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith('.md')) continue;
      const id = `${month.name}/${file.name.slice(0, -3)}`;
      try { taskPath(root, id); } catch { continue; }
      const content = await readFile(join(dir, month.name, file.name), 'utf8');
      const status = content.match(/^status:\s*(\S+)/m)?.[1];
      if (!statuses.has(status)) throw new Error(`Invalid status in ${id}`);
      if (status === 'active' || status === 'blocked') result.push({ id, status, title: content.match(/^# (.+)$/m)?.[1] ?? id });
    }
  }
  return result.sort((a,b) => a.id.localeCompare(b.id));
}
