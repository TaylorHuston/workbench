import { promises as fs } from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createAgentSession, createSyntheticSourceInfo, DefaultPackageManager, DefaultResourceLoader, getAgentDir, hasTrustRequiringProjectResources, loadSkills, ProjectTrustStore, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { createArchiveStore } from './archive.mjs';

// Opens saved sessions in a new SDK runtime; it cannot attach to a running CLI process.
export function createAgentHost({ agentDir = getAgentDir(), stateDir = join(agentDir, 'pi-workbench'), makeSession, settingsFactory } = {}) {
  const sessionDir = join(stateDir, 'sessions'), lockDir = join(stateDir, 'locks');
  const archive = createArchiveStore(stateDir);
  let active, busy = false, opening = false, partial = '', runPromise;
  let knownSessions = new Map();
  const listeners = new Set();
  const publish = (event) => { for (const listener of listeners) { try { listener(event); } catch { listeners.delete(listener); } } };
  const text = (content) => typeof content === 'string' ? content : Array.isArray(content) ? content.filter((block) => block.type === 'text').map((block) => block.text).join('') : '';
  const project = (message) => {
    if (message.role !== 'user' && message.role !== 'assistant') return null;
    const value = text(message.content);
    return value ? { role: message.role, text: value } : null;
  };
  const snapshot = () => active ? {
    id: active.session.sessionId, key: active.key, cwd: active.cwd, busy, reloading: opening, warning: active.warning,
    model: active.session.model ? `${active.session.model.provider}/${active.session.model.id}` : null,
    tools: active.session.getActiveToolNames(),
    messages: active.session.messages.map(project).filter(Boolean), partial,
  } : null;
  async function ensureState() {
    await fs.mkdir(lockDir, { recursive: true, mode: 0o700 });
  }
  async function normalizeCwd(cwd) {
    if (typeof cwd !== 'string' || !isAbsolute(cwd)) throw new Error('Enter an absolute working directory');
    const path = await fs.realpath(cwd);
    if (!(await fs.stat(path)).isDirectory()) throw new Error('Working directory must be a folder');
    return path;
  }
  const keyFor = (path) => createHash('sha256').update(path).digest('hex');
  async function discoverSkills(cwd, settings) {
    const needsTrust = hasTrustRequiringProjectResources(cwd);
    const savedTrust = new ProjectTrustStore(agentDir).get(cwd);
    const trusted = savedTrust ?? (!needsTrust || settings.getDefaultProjectTrust() === 'always');
    const skillSettings = SettingsManager.create(cwd, agentDir, { projectTrusted: trusted });
    const manager = new DefaultPackageManager({ cwd, agentDir, settingsManager: skillSettings });
    const missing = [];
    // Discover installed resources without installing missing packages or starting extensions.
    const paths = await manager.resolve(async (source) => { missing.push(source); return 'skip'; });
    const enabled = paths.skills.filter((resource) => resource.enabled);
    const result = loadSkills({ cwd, agentDir, skillPaths: enabled.map((resource) => resource.path), includeDefaults: false });
    for (const skill of result.skills) {
      const file = resolve(skill.filePath);
      const resource = enabled.find((entry) => file === resolve(entry.path) || file.startsWith(resolve(entry.path) + sep));
      if (resource) skill.sourceInfo = createSyntheticSourceInfo(skill.filePath, resource.metadata);
    }
    const warnings = [];
    if (!trusted && needsTrust) warnings.push('Project skills skipped: Pi project trust has not been granted.');
    if (missing.length) warnings.push(`${missing.length} uninstalled Pi package(s) skipped.`);
    if (result.diagnostics.length) warnings.push(`${result.diagnostics.length} skill discovery warning(s).`);
    return { result, warnings };
  }
  async function discover() {
    const nativeRoot = join(agentDir, 'sessions');
    let groups;
    try { groups = await fs.readdir(nativeRoot, { withFileTypes: true }); }
    catch (error) { if (error.code !== 'ENOENT') throw error; groups = []; }
    const directories = groups.filter((entry) => entry.isDirectory() || entry.isSymbolicLink()).map((entry) => join(nativeRoot, entry.name));
    const results = [];
    for (const directory of [nativeRoot, ...directories, sessionDir]) results.push(...await SessionManager.listAll(directory));
    return results.sort((a, b) => b.modified.getTime() - a.modified.getTime());
  }
  async function list() {
    const [sessions, archived] = await Promise.all([discover(), archive.list()]);
    knownSessions = new Map(sessions.map((info) => [keyFor(info.path), info.path]));
    return sessions.map((info) => ({ key: keyFor(info.path), id: info.id, cwd: info.cwd, name: info.name || info.firstMessage || 'Untitled session', modified: info.modified, archived: Object.hasOwn(archived, keyFor(info.path)) }));
  }
  async function setArchived(key, archived) {
    if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key) || typeof archived !== 'boolean') throw new Error('Invalid archive request');
    const path = knownSessions.get(key);
    if (!path) throw new Error('Session not found; refresh the session list');
    try { if (!(await fs.stat(path)).isFile()) throw new Error('Not a file'); }
    catch (error) { if (error.code === 'ENOENT' || error.message === 'Not a file') throw new Error('Session not found; refresh the session list'); throw error; }
    try { await archive.set(key, archived); }
    catch (error) { throw new Error(`Archive change failed or is uncertain; refresh and inspect before retrying. ${error.message}`); }
    publish({ type: 'archives_changed', key, archived });
    return { ok: true };
  }
  async function acquire(id) {
    if (!/^[a-f0-9-]+$/i.test(id)) throw new Error('Invalid session ID');
    const path = join(lockDir, id), owner = randomUUID();
    try { await fs.mkdir(path, { mode: 0o700 }); }
    catch (error) { if (error.code === 'EEXIST') throw new Error('Session is already in use or has a stale Workbench lock; inspect the lock before recovery'); throw error; }
    try { await fs.writeFile(join(path, 'owner.json'), JSON.stringify({ owner, pid: process.pid, created: new Date().toISOString() }), { flag: 'wx', mode: 0o600 }); }
    catch (error) { await fs.rmdir(path).catch(() => {}); throw error; }
    return { path, owner };
  }
  async function release(lock) {
    const metadata = JSON.parse(await fs.readFile(join(lock.path, 'owner.json'), 'utf8'));
    if (metadata.owner !== lock.owner) throw new Error('Session lock ownership changed; not removing it');
    await fs.unlink(join(lock.path, 'owner.json')); await fs.rmdir(lock.path);
  }
  async function closeActive() {
    if (!active) return;
    if (busy) throw new Error('Stop the current run before switching sessions');
    const old = active; active = undefined; partial = '';
    old.unsubscribe(); old.session.dispose();
    await release(old.lock); publish({ type: 'snapshot', value: null });
  }
  async function close() {
    if (opening) throw new Error('Wait for the session to finish opening');
    await closeActive();
  }
  async function open(key) {
    if (opening) throw new Error('A session is already opening');
    if (busy) throw new Error('Stop the current run before switching sessions');
    opening = true; let lock, session;
    try {
      if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) throw new Error('Select an existing session');
      const matches = (await discover()).filter((info) => keyFor(info.path) === key);
      if (matches.length !== 1) throw new Error('Session not found; refresh the session list');
      const info = matches[0];
      if (!info.cwd) throw new Error('This session has no recorded working directory');
      const path = await normalizeCwd(info.cwd); await ensureState();
      lock = await acquire(/^[a-f0-9-]+$/i.test(info.id) ? info.id : key);
      const manager = SessionManager.open(info.path, dirname(info.path));
      if (manager.getSessionId() !== info.id || manager.getCwd() !== info.cwd) throw new Error('Session identity changed; refresh the session list');
      const settings = settingsFactory ? settingsFactory(path, agentDir) : SettingsManager.create(path, agentDir, { projectTrusted: false });
      const { result: discoveredSkills, warnings: skillWarnings } = await discoverSkills(path, settings);
      const skills = { current: discoveredSkills };
      // Keep project settings out of the runtime; only the skill resolver observes trusted project settings.
      // The base loader has no packages so its reload cannot install missing packages as a side effect.
      const loaderSettings = SettingsManager.inMemory({ ...settings.getGlobalSettings(), packages: [] }, { projectTrusted: false });
      const loader = new DefaultResourceLoader({ cwd: path, agentDir, settingsManager: loaderSettings, noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, skillsOverride: () => skills.current });
      await loader.reload();
      const result = makeSession ? await makeSession({ cwd: path, agentDir, settings, loader, manager }) : await createAgentSession({ cwd: path, agentDir, settingsManager: settings, resourceLoader: loader, sessionManager: manager });
      session = result.session;
      await session.bindExtensions({ mode: 'json' });
      await closeActive();
      const unsubscribe = session.subscribe((event) => {
        if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') { partial += event.assistantMessageEvent.delta; publish({ type: 'delta', text: event.assistantMessageEvent.delta }); }
        if (event.type === 'message_end') {
          const message = project(event.message);
          if (event.message.role === 'assistant') {
            partial = '';
            if (event.message.stopReason === 'error') publish({ type: 'error', message: event.message.errorMessage || 'The model returned an error.' });
            else if (event.message.stopReason === 'aborted') publish({ type: 'error', message: 'Run stopped.' });
          }
          if (message) publish({ type: 'message', value: message });
        }
        if (event.type === 'tool_execution_start') publish({ type: 'tool', name: event.toolName, phase: 'start' });
        if (event.type === 'tool_execution_end') publish({ type: 'tool', name: event.toolName, phase: 'end', isError: event.isError });
      });
      active = { cwd: path, key, session, lock, unsubscribe, skills, modelWarning: result.modelFallbackMessage || null, warning: [result.modelFallbackMessage, ...skillWarnings].filter(Boolean).join(' ') || null }; lock = undefined; session = undefined;
      opening = false; publish({ type: 'snapshot', value: snapshot() });
      return snapshot();
    } catch (error) {
      session?.dispose(); if (lock) await release(lock).catch(() => {}); throw error;
    } finally { opening = false; }
  }
  async function reload(key) {
    if (!active || active.key !== key) throw new Error('Session changed; review the active session before retrying');
    if (opening) throw new Error('Wait for the session to finish opening or reloading');
    if (busy) throw new Error('Stop the current run before reloading');
    const current = active; opening = true; publish({ type: 'snapshot', value: snapshot() });
    let failure;
    try {
      const settings = settingsFactory ? settingsFactory(current.cwd, agentDir) : SettingsManager.create(current.cwd, agentDir, { projectTrusted: false });
      const { result: skills, warnings } = await discoverSkills(current.cwd, settings);
      current.skills.current = skills;
      await current.session.reload();
      current.warning = [current.modelWarning, ...warnings].filter(Boolean).join(' ') || null;
    } catch (error) {
      failure = new Error(`Session reload failed; the runtime may be partially reloaded. Close and reopen it if needed. ${error.message}`);
    } finally {
      opening = false; publish({ type: 'snapshot', value: snapshot() });
    }
    if (failure) { publish({ type: 'error', message: failure.message }); throw failure; }
    return snapshot();
  }
  function send(message) {
    if (!active) throw new Error('Open a session first');
    if (busy || opening) throw new Error('Agent is already running');
    if (typeof message !== 'string' || !message.trim()) throw new Error('Enter a message');
    busy = true; partial = ''; publish({ type: 'busy', value: true });
    const session = active.session;
    runPromise = session.prompt(message).catch((error) => publish({ type: 'error', message: error.message })).finally(() => {
      busy = false; partial = ''; publish({ type: 'snapshot', value: snapshot() });
    });
    return { accepted: true };
  }
  async function stop() { if (active && busy) { await active.session.abort(); await runPromise; } }
  function subscribe(listener) { listeners.add(listener); listener({ type: 'snapshot', value: snapshot() }); return () => listeners.delete(listener); }
  return { list, open, close, reload, send, stop, snapshot, subscribe, setArchived };
}
