import { appendFile, mkdir, open, readFile, readdir, stat } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { realpathSync } from "node:fs";
import { randomUUID } from "node:crypto";

const types = new Set([
  "note",
  "attempt",
  "decision",
  "blocker",
  "evidence",
  "checkpoint",
  "resume",
  "handoff",
  "correction",
]);
const statuses = new Set(["active", "blocked", "done", "dropped"]);
const dayTypes = new Set(["task_open", "task_reopen", "task_close", "decision", "outcome", "blocker", "note"]);

function localTimestamp(timestamp = new Date()) {
  if (!(timestamp instanceof Date) || Number.isNaN(timestamp.getTime())) throw new Error("Invalid timestamp");
  const offset = -timestamp.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const pad = (n) => String(n).padStart(2, "0");
  return `${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())}T${pad(timestamp.getHours())}:${pad(timestamp.getMinutes())}:${pad(timestamp.getSeconds())}${sign}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
}
function validateSession(session) {
  if (
    !session ||
    typeof session.harness !== "string" ||
    !session.harness.trim() ||
    typeof session.id !== "string" ||
    !session.id.trim()
  )
    throw new Error("Full session attribution is required");
}
function dayPath(root, date) {
  root = rootPath(root);
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Invalid day: expected YYYY-MM-DD");
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== date) throw new Error("Invalid calendar date");
  return join(root, "days", `${date}.jsonl`);
}
function parseLog(log, label) {
  return log
    .split("\n")
    .map((line, i) => {
      if (!line.trim()) return null;
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`Invalid ${label} log entry at line ${i + 1}`);
      }
    })
    .filter((x) => x !== null);
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function validateEntryId(id) {
  if (typeof id !== "string" || !uuidPattern.test(id)) throw new Error("Entry id must be a lowercase UUID v4");
}
async function appendUnique(file, entry, label) {
  validateEntryId(entry.id);
  let log;
  try {
    log = await readFile(file, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    log = "";
  }
  if (log && !log.endsWith("\n")) throw new Error(`Incomplete ${label} log: missing final newline`);
  const seen = new Set();
  for (const prior of parseLog(log, label)) {
    if (prior === null || typeof prior !== "object" || !("id" in prior)) continue; // Legacy experimental entries have no ID.
    validateEntryId(prior.id);
    if (seen.has(prior.id)) throw new Error(`Duplicate entry id in ${label} log: ${prior.id}`);
    seen.add(prior.id);
  }
  if (seen.has(entry.id)) throw new Error(`Duplicate entry id in ${label} log: ${entry.id}`);
  await appendFile(file, JSON.stringify(entry) + "\n", { encoding: "utf8", mode: 0o600 });
}
export async function openDay(root, date = localTimestamp().slice(0, 10)) {
  const file = dayPath(root, date);
  let log;
  try {
    log = await readFile(file, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    return { date, entries: [] };
  }
  return { date, entries: parseLog(log, "day") };
}
export async function appendDay(root, type, comment, session, task, timestamp = new Date(), entryId = randomUUID()) {
  if (!dayTypes.has(type)) throw new Error("Invalid day entry type");
  comment = nonempty(comment, "comment");
  validateSession(session);
  if (task !== undefined) taskPath(root, task);
  const ts = localTimestamp(timestamp);
  const file = dayPath(root, ts.slice(0, 10));
  const entry = { id: entryId, ts, session, type, ...(task !== undefined ? { task } : {}), comment };
  await mkdir(join(rootPath(root), "days"), { recursive: true });
  await appendUnique(file, entry, "day");
  return entry;
}
export async function createTaskWithDay(root, id, title, description, currentState, session, timestamp = new Date()) {
  validateSession(session);
  const ts = localTimestamp(timestamp);
  const entryId = randomUUID();
  const task = await createTask(root, id, title, description, currentState);
  try {
    const dayEntry = await appendDay(root, "task_open", `Started: ${title.trim()}`, session, id, timestamp, entryId);
    return { task, day: { status: "appended", entry: dayEntry } };
  } catch (error) {
    return {
      task,
      day: {
        status: "uncertain",
        date: ts.slice(0, 10),
        intendedEntry: { id: entryId, ts, session, type: "task_open", task: id, comment: `Started: ${title.trim()}` },
        message:
          "Task created, but day append failed or has an unknown outcome. Inspect the day log before manually appending; do not recreate the task or retry blindly.",
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

function rootPath(root) {
  if (!root || !isAbsolute(root))
    throw new Error("PI_TASKS_ROOT must be an explicit absolute path to an isolated experimental store");
  const resolved = realpathSync(root);
  if (resolved.split("/").includes(".llm")) throw new Error("The experimental store cannot target .llm");
  return resolved;
}
function taskPath(root, id) {
  root = rootPath(root);
  if (
    !/^\d{4}-\d{2}\/\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ||
    !id.startsWith(id.slice(0, 7) + "/" + id.slice(0, 7))
  )
    throw new Error("Invalid task ID");
  return join(root, "tasks", id);
}
function nonempty(value, name) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}
function headingFree(value, name) {
  value = nonempty(value, name);
  if (/^#{1,2}\s/m.test(value)) throw new Error(`${name} cannot contain level 1 or 2 headings`);
  return value;
}
export async function createTask(root, id, title, description, currentState) {
  const base = taskPath(root, id);
  title = nonempty(title, "title");
  if (/[\r\n]/.test(title)) throw new Error("title must be one line");
  description = headingFree(description, "description");
  currentState = headingFree(currentState, "currentState");
  await mkdir(join(base, ".."), { recursive: true });
  const content = `status: active\n\n# ${title}\n\n## Description\n${description}\n\n## Current state\n${currentState}\n`;
  const file = await open(`${base}.md`, "wx");
  try {
    await file.writeFile(content, "utf8");
  } finally {
    await file.close();
  }
  return { id, content };
}
export async function readTask(root, id) {
  const base = taskPath(root, id);
  const content = await readFile(`${base}.md`, "utf8");
  let log;
  try {
    log = await readFile(`${base}.jsonl`, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    log = "";
  }
  const entries = parseLog(log, "task");
  return { id, content, entries };
}
export async function appendTask(root, id, type, comment, session, timestamp = new Date(), entryId = randomUUID()) {
  const base = taskPath(root, id);
  if (!types.has(type)) throw new Error("Invalid entry type");
  comment = nonempty(comment, "comment");
  validateSession(session);
  await stat(`${base}.md`);
  const entry = { id: entryId, ts: localTimestamp(timestamp), session, type, comment };
  await appendUnique(`${base}.jsonl`, entry, "task");
  return entry;
}
export async function updateCurrentState(root, id, currentState, expectedContent) {
  const base = taskPath(root, id);
  currentState = headingFree(currentState, "currentState");
  if (typeof expectedContent !== "string") throw new Error("expectedContent from readTask is required");
  const file = await open(`${base}.md`, "r+");
  try {
    const before = await file.readFile("utf8");
    if (before !== expectedContent) throw new Error("Task changed since it was read; read it again");
    const pattern = /(^## Current state[ \t]*\n)[\s\S]*?(?=^## |(?![\s\S]))/m;
    const match = before.match(pattern);
    if (!match) throw new Error("Expected a Current state section");
    const after = before.replace(pattern, `$1${currentState}\n\n`);
    await file.write(after, 0, "utf8");
    await file.truncate(Buffer.byteLength(after));
    return { id, content: after };
  } finally {
    await file.close();
  }
}
export async function closeTask(root, id, status, conclusion, expectedContent, session, timestamp = new Date()) {
  const base = taskPath(root, id);
  if (status !== "done" && status !== "dropped") throw new Error("Closure status must be done or dropped");
  conclusion = headingFree(conclusion, "conclusion");
  if (typeof expectedContent !== "string") throw new Error("expectedContent from readTask is required");
  validateSession(session);
  const ts = localTimestamp(timestamp);
  const entryId = randomUUID();
  const file = await open(`${base}.md`, "r+");
  let after, title;
  try {
    const before = await file.readFile("utf8");
    if (before !== expectedContent) throw new Error("Task changed since it was read; read it again");
    const states = [...before.matchAll(/^status:[ \t]*(\S+)[ \t]*$/gm)];
    if (states.length !== 1 || !statuses.has(states[0][1])) throw new Error("Task must have one valid status");
    if (states[0][1] === "done" || states[0][1] === "dropped") throw new Error("Task is already closed");
    if (/^## Conclusion[ \t]*$/m.test(before))
      throw new Error("Task already has a conclusion; preserve it and resolve manually");
    const current = /(^## Current state[ \t]*\n)[\s\S]*?(?=^## |(?![\s\S]))/gm;
    if ([...before.matchAll(current)].length !== 1) throw new Error("Task must have one Current state section");
    const titles = [...before.matchAll(/^# (.+)$/gm)];
    if (titles.length !== 1) throw new Error("Task must have one title");
    title = titles[0][1].trim();
    after = before
      .replace(/^status:[ \t]*\S+[ \t]*$/m, () => `status: ${status}`)
      .replace(current, (_match, heading) => `${heading}Closed (${status}).\n\n`);
    after += `${after.endsWith("\n") ? "\n" : "\n\n"}## Conclusion\n${conclusion}\n`;
    await file.write(after, 0, "utf8");
    await file.truncate(Buffer.byteLength(after));
  } finally {
    await file.close();
  }
  const task = { id, content: after };
  const comment = `Closed: ${title}`;
  try {
    const entry = await appendDay(root, "task_close", comment, session, id, timestamp, entryId);
    return { task, day: { status: "appended", entry } };
  } catch (error) {
    return {
      task,
      day: {
        status: "uncertain",
        date: ts.slice(0, 10),
        intendedEntry: { id: entryId, ts, session, type: "task_close", task: id, comment },
        message:
          "Task closed, but day append failed or has an unknown outcome. Inspect the day log before manually appending; do not reopen the task or retry blindly.",
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
export async function listOpenTasks(root) {
  const dir = join(rootPath(root), "tasks");
  let months;
  try {
    months = await readdir(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
  const result = [];
  for (const month of months.filter((x) => x.isDirectory() && /^\d{4}-\d{2}$/.test(x.name))) {
    for (const file of await readdir(join(dir, month.name), { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith(".md")) continue;
      const id = `${month.name}/${file.name.slice(0, -3)}`;
      try {
        taskPath(root, id);
      } catch {
        continue;
      }
      const content = await readFile(join(dir, month.name, file.name), "utf8");
      const status = content.match(/^status:\s*(\S+)/m)?.[1];
      if (!statuses.has(status)) throw new Error(`Invalid status in ${id}`);
      if (status === "active" || status === "blocked")
        result.push({ id, status, title: content.match(/^# (.+)$/m)?.[1] ?? id });
    }
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}
