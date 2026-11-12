import { promises as fs } from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createAgentSession, createSyntheticSourceInfo, DefaultPackageManager, DefaultResourceLoader, getAgentDir, hasTrustRequiringProjectResources, loadSkills, ProjectTrustStore, SessionManager, SettingsManager } from '@earendil-works/pi-coding-agent';
import { createArchiveStore } from './archive.mjs';
import { createWorkspaceStore } from './workspaces.mjs';
import { createExtensionDialogs } from './extension-ui.mjs';

// Opens saved sessions in a new SDK runtime; it cannot attach to a running CLI process.
export function createAgentHost({ agentDir = getAgentDir(), stateDir = join(agentDir, 'pi-workbench'), makeSession, settingsFactory } = {}) {
  const sessionDir = join(stateDir, 'sessions'), lockDir = join(stateDir, 'locks');
  const archive = createArchiveStore(stateDir), workspaces = createWorkspaceStore(stateDir);
  let active, busy = false, opening = false, partial = '', runPromise;
  let knownSessions = new Map();
  const listeners = new Set();
  const publish = (event) => { for (const listener of listeners) { try { listener(event); } catch { listeners.delete(listener); } } if (!listeners.size) dialogs.cancelAll(); };
  const dialogs = createExtensionDialogs({ publish, hasViewers: () => listeners.size > 0 });
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
  async function discoverGlobalExtensions(cwd, settings) {
    const globalSettings = SettingsManager.inMemory({ ...settings.getGlobalSettings() }, { projectTrusted: false });
    const manager = new DefaultPackageManager({ cwd, agentDir, settingsManager: globalSettings });
    const missing = [];
    const paths = await manager.resolve(async (source) => { missing.push(source); return 'skip'; });
    return { paths: paths.extensions.filter((entry) => entry.enabled && entry.metadata.scope === 'user').map((entry) => entry.path), missing };
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
    knownSessions = new Map(sessions.map((info) => [keyFor(info.path), { path: info.path, id: info.id, cwd: info.cwd }]));
    const directories = [...new Set(sessions.map((info) => info.cwd).filter((cwd) => typeof cwd === 'string' && isAbsolute(cwd)))];
    const canonical = new Map(await Promise.all(directories.map(async (cwd) => [cwd, await fs.realpath(cwd).catch(() => cwd)])));
    const result = sessions.map((info) => ({ key: keyFor(info.path), id: info.id, cwd: canonical.get(info.cwd) ?? info.cwd, name: info.name || info.firstMessage || 'Untitled session', modified: info.modified, archived: Object.hasOwn(archived, keyFor(info.path)) }));
    // Pi creates the JSONL only on the first message; show a new empty session while it is open.
    if (active?.createdHere && !result.some((item) => item.key === active.key)) result.unshift({ key: active.key, id: active.session.sessionId, cwd: active.cwd, name: active.session.sessionManager.getSessionName() || 'New session', modified: active.createdAt, archived: false, transient: true });
    return result;
  }
  async function setArchived(key, archived) {
    if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key) || typeof archived !== 'boolean') throw new Error('Invalid archive request');
    const path = knownSessions.get(key)?.path;
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
    const old = active; active = undefined; partial = ''; dialogs.cancelAll();
    old.unsubscribe(); const errorsBefore = old.extensionErrors.length;
    try { await old.session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' }); }
    finally { old.session.dispose(); await release(old.lock); publish({ type: 'snapshot', value: null }); }
    if (old.createdHere) publish({ type: 'sessions_changed' });
    if (old.extensionErrors.length > errorsBefore) throw new Error(`Extension shutdown failed; inspect any external processes before retrying. ${old.extensionErrors.slice(errorsBefore).join('; ')}`);
  }
  async function close() {
    if (opening) throw new Error('Wait for the session to finish opening');
    await closeActive();
  }
  async function open(key, newCwd) {
    if (opening) throw new Error('A session is already opening');
    if (busy) throw new Error('Stop the current run before switching sessions');
    opening = true; let lock, session;
    try {
      let path, manager; const createdHere = newCwd !== undefined;
      if (createdHere) {
        path = await normalizeCwd(newCwd); await ensureState();
        // Pi's standard per-cwd session directory, using its pinned SDK's encoding.
        const group = `--${path.replace(/^[/\\\\]/, '').replace(/[/\\\\:]/g, '-')}--`;
        manager = SessionManager.create(path, join(agentDir, 'sessions', group));
        key = keyFor(manager.getSessionFile());
        lock = await acquire(manager.getSessionId());
      } else {
        if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) throw new Error('Select an existing session');
        let info = knownSessions.get(key);
        if (!info) {
          const matches = (await discover()).filter((entry) => keyFor(entry.path) === key);
          if (matches.length !== 1) throw new Error('Session not found; refresh the session list');
          info = matches[0];
        }
        try { if (!(await fs.stat(info.path)).isFile()) throw new Error('Not a file'); }
        catch (error) { if (error.code === 'ENOENT' || error.message === 'Not a file') throw new Error('Session not found; refresh the session list'); throw error; }
        if (!info.cwd) throw new Error('This session has no recorded working directory');
        path = await normalizeCwd(info.cwd); await ensureState();
        lock = await acquire(/^[a-f0-9-]+$/i.test(info.id) ? info.id : key);
        manager = SessionManager.open(info.path, dirname(info.path));
        if (manager.getSessionId() !== info.id || manager.getCwd() !== info.cwd) throw new Error('Session identity changed; refresh the session list');
      }
      const settings = settingsFactory ? settingsFactory(path, agentDir) : SettingsManager.create(path, agentDir, { projectTrusted: false });
      const { result: discoveredSkills, warnings: skillWarnings } = await discoverSkills(path, settings);
      const globalExtensions = await discoverGlobalExtensions(path, settings);
      const skills = { current: discoveredSkills };
      // Resolve only installed global paths above; the loader cannot install packages or autoload project extensions.
      const loaderSettings = SettingsManager.inMemory({ ...settings.getGlobalSettings(), packages: [], extensions: [] }, { projectTrusted: false });
      const loader = new DefaultResourceLoader({ cwd: path, agentDir, settingsManager: loaderSettings, noExtensions: true, additionalExtensionPaths: globalExtensions.paths, noSkills: true, noPromptTemplates: true, noThemes: true, skillsOverride: () => skills.current });
      // Loading extension modules can itself have side effects; do not overlap two extension runtimes.
      if (active && (active.extensionCount || globalExtensions.paths.length)) await closeActive();
      await loader.reload();
      const extensionResult = loader.getExtensions();
      if (extensionResult.errors.length) throw new Error(`Global extension loading failed: ${extensionResult.errors.map((entry) => `${entry.path}: ${entry.error}`).join('; ')}`);
      const result = makeSession ? await makeSession({ cwd: path, agentDir, settings, loader, manager }) : await createAgentSession({ cwd: path, agentDir, settingsManager: settings, resourceLoader: loader, sessionManager: manager });
      session = result.session;
      const extensionErrors = [], boundSession = session;
      await session.bindExtensions({ mode: 'rpc', uiContext: dialogs.context(session.extensionRunner.getUIContext()), onError: (error) => {
        const message = `Extension error (${error.event}): ${error.error}`; extensionErrors.push(message);
        if (active?.session === boundSession) {
          const first = !active.unsafe; active.unsafe = true; active.warning = `${message} Close and reopen the session before continuing.`;
          publish({ type: 'error', message: active.warning });
          if (first && busy) void boundSession.abort().catch(() => {});
        }
      } });
      if (extensionErrors.length) throw new Error(`Global extension startup failed: ${extensionErrors.join('; ')}`);
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
      const extensionWarning = extensionResult.extensions.length ? 'Global extensions are active. Basic dialogs are supported; custom terminal UI is not.' : null;
      const missingWarning = globalExtensions.missing.length ? `${globalExtensions.missing.length} uninstalled global Pi package(s) skipped.` : null;
      active = { cwd: path, key, session, lock, unsubscribe, skills, loader, extensionPaths: globalExtensions.paths, extensionErrors, extensionCount: extensionResult.extensions.length, extensionWarning, missingWarning, unsafe: false, createdHere, sessionPath: manager.getSessionFile(), createdAt: new Date().toISOString(), modelWarning: result.modelFallbackMessage || null, warning: [result.modelFallbackMessage, ...skillWarnings, extensionWarning, missingWarning].filter(Boolean).join(' ') || null }; lock = undefined; session = undefined;
      opening = false; publish({ type: 'snapshot', value: snapshot() });
      if (createdHere) publish({ type: 'sessions_changed' });
      return snapshot();
    } catch (error) {
      if (session) { try { await session.extensionRunner.emit({ type: 'session_shutdown', reason: 'quit' }); } catch { /* Preserve the original startup error. */ } finally { session.dispose(); } }
      if (lock) await release(lock).catch(() => {}); throw error;
    } finally { opening = false; }
  }
  async function reload(key) {
    if (!active || active.key !== key) throw new Error('Session changed; review the active session before retrying');
    if (opening) throw new Error('Wait for the session to finish opening or reloading');
    if (busy) throw new Error('Stop the current run before reloading');
    const current = active; opening = true; publish({ type: 'snapshot', value: snapshot() });
    let failure, reloadingRuntime = false;
    try {
      const settings = settingsFactory ? settingsFactory(current.cwd, agentDir) : SettingsManager.create(current.cwd, agentDir, { projectTrusted: false });
      const { result: skills, warnings } = await discoverSkills(current.cwd, settings);
      const globalExtensions = await discoverGlobalExtensions(current.cwd, settings);
      if (JSON.stringify(globalExtensions.paths) !== JSON.stringify(current.extensionPaths)) throw new Error('Global extension selection changed; close and reopen the session to apply it.');
      current.skills.current = skills;
      const errorsBefore = current.extensionErrors.length; reloadingRuntime = true; dialogs.cancelAll();
      await current.session.reload();
      const errors = current.loader.getExtensions().errors;
      if (errors.length || current.extensionErrors.length > errorsBefore) throw new Error('A global extension failed to load or start.');
      current.unsafe = false;
      current.warning = [current.modelWarning, ...warnings, current.extensionWarning, current.missingWarning].filter(Boolean).join(' ') || null;
    } catch (error) {
      if (reloadingRuntime) current.unsafe = true;
      failure = new Error(`Session reload failed${reloadingRuntime ? '; the runtime may be partially reloaded. Close and reopen it before continuing' : ''}. ${error.message}`);
      current.warning = failure.message;
    } finally {
      opening = false; publish({ type: 'snapshot', value: snapshot() });
    }
    if (failure) { publish({ type: 'error', message: failure.message }); throw failure; }
    return snapshot();
  }
  function rename(key, name) {
    if (!active || active.key !== key) throw new Error('Session changed; review the active session before retrying');
    if (busy || opening) throw new Error('Finish the current run before renaming the session');
    if (typeof name !== 'string' || !name.trim() || /[\r\n]/.test(name) || name.trim().length > 200) throw new Error('Enter a session name of at most 200 characters');
    active.session.setSessionName(name.trim());
    publish({ type: 'sessions_changed' });
    return { name: active.session.sessionManager.getSessionName() };
  }
  function send(message, document = null) {
    if (!active) throw new Error('Open a session first');
    if (active.unsafe) throw new Error('Extension failure or incomplete reload; close and reopen the session before continuing');
    if (busy || opening) throw new Error('Agent is already running');
    if (typeof message !== 'string' || !message.trim()) throw new Error('Enter a message');
    busy = true; partial = ''; publish({ type: 'busy', value: true });
    const running = active, session = active.session;
    const prompt = document === null ? message : `${message}\n\n[Workbench context: the document open in the editor is ${JSON.stringify(document)} (path relative to the session working directory). Read it from disk if needed; this is a path, not document content.]`;
    runPromise = session.prompt(prompt).catch((error) => publish({ type: 'error', message: error.message })).finally(async () => {
      let appeared = false;
      if (running.createdHere) {
        try { if ((await fs.stat(running.sessionPath)).isFile()) { running.createdHere = false; appeared = true; } }
        catch (error) { if (error.code !== 'ENOENT') publish({ type: 'error', message: `Could not check new session file: ${error.message}` }); }
      }
      busy = false; partial = ''; publish({ type: 'snapshot', value: snapshot() });
      if (appeared) publish({ type: 'sessions_changed' });
    });
    return { accepted: true };
  }
  async function stop() { const abort = active && busy ? active.session.abort() : undefined; dialogs.cancelAll(); if (abort) { await abort; await runPromise; } }
  function subscribe(listener) {
    listeners.add(listener); listener({ type: 'snapshot', value: snapshot() }); dialogs.replay(listener);
    return () => { listeners.delete(listener); if (!listeners.size) dialogs.cancelAll(); };
  }
  async function addWorkspace(path, name) { const workspace = await workspaces.add(path, name); publish({ type: 'workspaces_changed' }); return { cwd: workspace.path, workspace }; }
  async function updateWorkspace(path, changes, revision) {
    try {
      const workspace = await workspaces.update(path, changes, revision); publish({ type: 'workspaces_changed' }); return { workspace };
    } catch (error) { throw new Error(`Workspace update failed or is uncertain; refresh and inspect before retrying. ${error.message}`); }
  }
  function createSession(cwd) { if (typeof cwd !== 'string') throw new Error('Enter an absolute working directory'); return open(undefined, cwd); }
  return { list, open, close, reload, rename, send, stop, snapshot, subscribe, respondDialog: dialogs.respond, setArchived, listWorkspaces: workspaces.list, addWorkspace, updateWorkspace, createSession };
}
