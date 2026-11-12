import { getWorkspace, refreshWorkspaces, selectWorkspace, showWorkspaceError, workspaceAvailable } from './workspace.js';
import { extensionDialogEvent, extensionDialogsDisconnected } from './extension-dialogs.js';

const $ = (selector) => document.querySelector(selector);
let state = null, live = null, lastError = '', draftSessionId = null, pendingNew = false, editorSessionKey = null;
let sessionsLoaded = false, listGeneration = 0, sessionVersion = 0, cachedSessions = [], sessionLoad;
const archiveVersions = new Map();
const activeHere = () => !!state && state.cwd === getWorkspace();

async function api(path, body) {
  const options = body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const response = await fetch(path, options); const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}
function status(message) { $('#agent-status').textContent = message; }
function row(role, text) {
  const item = document.createElement('article'); item.className = `agent-message ${role}`;
  const label = document.createElement('strong'); label.textContent = role === 'user' ? 'You' : 'Pi';
  const body = document.createElement('div'); body.textContent = text; item.append(label, body); $('#agent-transcript').append(item);
  $('#agent-transcript').scrollTop = $('#agent-transcript').scrollHeight; return body;
}
function controls() {
  const running = !!state?.busy, reloading = !!state?.reloading, open = activeHere(), hasDraft = !!$('#agent-message').value.trim();
  $('#agent-close').disabled = $('#agent-reload').disabled = !open || running || reloading;
  $('#session-new').disabled = !getWorkspace() || running || reloading;
  $('#session-select').disabled = !getWorkspace() || running || reloading || !sessionsLoaded;
  $('#session-select').value = open ? state.key : '';
  document.querySelectorAll('.session-button').forEach((button) => {
    button.disabled = running || reloading;
    if (open && button.dataset.key === state?.key) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
  $('#agent-send').disabled = !open || running || reloading || !state.model;
  $('#agent-message').disabled = running || reloading || (!open && !hasDraft) || (open && !state.model && !hasDraft);
  $('#agent-stop').disabled = !running; $('#agent-stop').hidden = !running; $('#agent-send').hidden = running;
  $('#session-runtime').hidden = !open;
  $('#agent-model').textContent = open ? state.model ?? 'No model available' : '';
  $('#agent-model').title = open ? `${state.cwd} · Tools: ${state.tools.length ? state.tools.join(', ') : 'none'}` : '';
}
function snapshot(value) {
  state = value; live = null; $('#agent-transcript').replaceChildren();
  if (activeHere() && state.key !== editorSessionKey) {
    editorSessionKey = state.key;
    document.dispatchEvent(new CustomEvent('agent-session-change', { detail: { key: state.key, created: pendingNew } }));
  }
  if (!activeHere()) {
    const p = document.createElement('p'); p.className = 'agent-placeholder'; p.textContent = 'Choose or start a session in this workspace.'; $('#agent-transcript').append(p);
  } else {
    for (const message of state.messages) row(message.role, message.text);
    if (state.partial) live = row('assistant', state.partial);
  }
  controls();
  if ($('#agent-message').value.trim() && draftSessionId && state?.key !== draftSessionId) status('Draft belongs to another session; copy or clear it before sending.');
  else if (!lastError) status(state?.reloading ? 'Reloading…' : state?.busy ? 'Running…' : activeHere() ? state.warning || 'Ready' : '');
}
const events = new EventSource('/api/agent/events');
events.onmessage = ({ data }) => {
  const event = JSON.parse(data);
  if (event.type === 'snapshot') snapshot(event.value);
  else if (event.type === 'busy' && state) { state.busy = event.value; lastError = ''; controls(); status('Running…'); }
  else if (event.type === 'delta' && activeHere()) { if (!live) live = row('assistant', ''); live.textContent += event.text; $('#agent-transcript').scrollTop = $('#agent-transcript').scrollHeight; }
  else if (event.type === 'message' && activeHere()) { if (event.value.role === 'assistant' && live) { live.parentElement.remove(); live = null; } row(event.value.role, event.value.text); }
  else if (event.type === 'tool') status(`${event.phase === 'start' ? 'Running' : event.isError ? 'Failed' : 'Finished'} tool: ${event.name}`);
  else if (event.type === 'error') { lastError = event.message; status(lastError); }
  else if (event.type === 'archives_changed' && sessionsLoaded) applyArchiveChange(event.key, event.archived);
  else if (event.type === 'sessions_changed' && sessionsLoaded) { sessionVersion++; void loadSessions(); }
  else if (event.type === 'workspaces_changed') void refreshWorkspaces();
  else if (event.type === 'extension_dialog' || event.type === 'extension_dialog_closed') extensionDialogEvent(event);
  else if (event.type === 'extension_notice') status(event.message);
};
events.onerror = () => { extensionDialogsDisconnected(); status('Disconnected; reconnecting…'); };
events.onopen = () => { lastError = ''; snapshot(state); void refreshWorkspaces(); void loadSessions(); };

async function action(fn) { try { lastError = ''; await fn(); } catch (error) { lastError = error.message; status(lastError); } }
async function mayChangeSession() {
  const from = state?.key, workspace = getWorkspace();
  const allowed = () => from === state?.key && workspace === getWorkspace() && !state?.busy && !state?.reloading && !$('#agent-message').value.trim();
  if (!allowed()) { status('Finish the current run and clear the unsent message before switching.'); return false; }
  const detail = { allowed };
  if (!document.dispatchEvent(new CustomEvent('session-before-change', { cancelable: true, detail }))) return false;
  if (detail.check && !(await detail.check)) return false;
  if (!allowed()) {
    status('The session or draft changed; review it before switching.'); return false;
  }
  return true;
}
function showView(sessions) {
  $('#explorer-panel').hidden = sessions; $('#sessions-panel').hidden = !sessions;
  $('#files-tab').setAttribute('aria-pressed', String(!sessions)); $('#agent-tab').setAttribute('aria-pressed', String(sessions));
}
function applyArchiveChange(key, archived) {
  if (!cachedSessions.some((session) => session.key === key)) { void loadSessions(); return; }
  archiveVersions.set(key, (archiveVersions.get(key) ?? 0) + 1); listGeneration++;
  cachedSessions = cachedSessions.map((session) => session.key === key ? { ...session, archived } : session);
  renderSessions();
}
function renderRows(parent, entries) {
  for (const entry of entries) {
    const container = document.createElement('div'); container.className = 'session-row';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'session-button'; button.dataset.key = entry.key;
    const title = document.createElement('span'); title.className = 'session-title'; title.textContent = entry.name; button.title = entry.name;
    const modified = document.createElement('small'); modified.className = 'session-date';
    const date = new Date(entry.modified); modified.textContent = entry.transient ? 'Not saved until first message' : Number.isNaN(date.valueOf()) ? '' : date.toLocaleString();
    button.append(title, modified);
    button.addEventListener('click', () => action(async () => {
      if (state?.key === entry.key) return;
      if ($('#agent-message').value.trim()) throw new Error('Copy or clear the unsent message before switching sessions.');
      if (!(await mayChangeSession())) return;
      status('Opening…'); snapshot(await api('/api/agent/open', { key: entry.key }));
      document.dispatchEvent(new CustomEvent('agent-session-selected', { detail: { key: entry.key } }));
    }));
    const archive = document.createElement('button'); archive.type = 'button'; archive.className = 'session-archive';
    archive.textContent = entry.archived ? 'Restore' : 'Archive'; archive.hidden = !!entry.transient; archive.setAttribute('aria-label', `${archive.textContent} ${entry.name}`);
    archive.title = entry.archived ? 'Return this session to the visible list' : 'Hide this session here without closing it';
    archive.addEventListener('click', async () => {
      const target = !entry.archived, revision = archiveVersions.get(entry.key) ?? 0;
      archive.disabled = true; $('#session-list-status').textContent = target ? 'Archiving…' : 'Restoring…';
      try {
        await api('/api/agent/archive', { key: entry.key, archived: target });
        if ((archiveVersions.get(entry.key) ?? 0) === revision) applyArchiveChange(entry.key, target);
      } catch (error) { $('#session-list-status').textContent = error.message; }
      finally { archive.disabled = false; }
    });
    container.append(button, archive); parent.append(container);
  }
}
function renderSessions() {
  const list = $('#session-list'), notice = $('#session-list-status');
  const wasExpanded = list.querySelector('.archived-sessions')?.open ?? false;
  list.replaceChildren();
  const selected = cachedSessions.filter((session) => session.cwd === getWorkspace());
  const visible = selected.filter((session) => !session.archived), archived = selected.filter((session) => session.archived);
  const picker = $('#session-select'); picker.replaceChildren(new Option('Choose a session…', ''));
  for (const entry of visible) picker.add(new Option(entry.name, entry.key));
  if (activeHere() && !visible.some(entry => entry.key === state.key)) picker.add(new Option('Current session (archived)', state.key));
  if (!visible.length) { const empty = document.createElement('p'); empty.className = 'tree-empty'; empty.textContent = 'No active sessions in this workspace.'; list.append(empty); }
  renderRows(list, visible);
  if (archived.length) {
    const section = document.createElement('details'); section.className = 'archived-sessions'; section.open = wasExpanded;
    const summary = document.createElement('summary'); summary.textContent = `Archived (${archived.length})`; section.append(summary);
    renderRows(section, archived); list.append(section);
  }
  controls(); notice.textContent = `${visible.length} active · ${archived.length} archived`;
}
function loadSessions() {
  const notice = $('#session-list-status'), generation = ++listGeneration; notice.textContent = 'Loading sessions…';
  const load = (async () => {
    try {
      const sessions = await api('/api/agent/sessions');
      if (generation !== listGeneration) { if (sessionLoad && sessionLoad !== load) await sessionLoad; return; }
      cachedSessions = sessions; sessionsLoaded = true; renderSessions();
    } catch (error) {
      if (generation === listGeneration) notice.textContent = error.message;
      else if (sessionLoad && sessionLoad !== load) await sessionLoad;
    }
  })();
  sessionLoad = load; return load;
}
document.addEventListener('workspace-before-change', (event) => {
  if (event.defaultPrevented) return;
  if (state?.busy || state?.reloading) { showWorkspaceError('Finish or stop the current run before switching workspaces.'); event.preventDefault(); }
  else if ($('#agent-message').value.trim()) { showWorkspaceError('Copy or clear the unsent message before switching workspaces.'); event.preventDefault(); }
});
document.addEventListener('workspace-change', () => { lastError = ''; editorSessionKey = null; queueMicrotask(() => {
  snapshot(state); if (sessionsLoaded) renderSessions();
  if (activeHere()) document.dispatchEvent(new CustomEvent('agent-session-reactivated', { detail: { key: state.key } }));
}); });
$('#files-tab').addEventListener('click', () => showView(false));
$('#agent-tab').addEventListener('click', () => { showView(true); if (!sessionsLoaded) void loadSessions(); });
$('#session-refresh').addEventListener('click', () => { void refreshWorkspaces(); void loadSessions(); });
$('#session-select').addEventListener('change', () => action(async () => {
  const key = $('#session-select').value;
  if (!key || key === state?.key) { controls(); return; }
  if ($('#agent-message').value.trim()) { controls(); throw new Error('Copy or clear the unsent message before switching sessions.'); }
  controls();
  if (!(await mayChangeSession())) { controls(); return; }
  try { status('Opening…'); snapshot(await api('/api/agent/open', { key })); document.dispatchEvent(new CustomEvent('agent-session-selected', { detail: { key } })); }
  finally { controls(); }
}));
$('#session-new').addEventListener('click', () => action(async () => {
  if ($('#agent-message').value.trim()) throw new Error('Copy or clear the unsent message before starting another session.');
  if (!(await mayChangeSession())) return;
  const revision = sessionVersion; $('#session-new').disabled = true; status('Starting session…');
  try { pendingNew = true; const created = await api('/api/agent/new', { cwd: getWorkspace() }); snapshot(created); document.dispatchEvent(new CustomEvent('agent-session-selected', { detail: { key: created.key } })); if (sessionVersion === revision) await loadSessions(); }
  finally { pendingNew = false; controls(); }
}));
document.addEventListener('open-session-route', (event) => { void (async () => {
  try {
    if (!cachedSessions.some(item => item.key === event.detail.key)) await loadSessions();
    const entry = cachedSessions.find(item => item.key === event.detail.key && !item.archived);
    if (!entry) throw new Error('This session is unavailable or archived.');
    if (!workspaceAvailable(entry.cwd)) throw new Error('The session workspace is unavailable or archived.');
    if (state?.key === entry.key && getWorkspace() === entry.cwd) { event.detail.resolve(true); return; }
    if ($('#agent-message').value.trim()) throw new Error('Copy or clear the unsent message before switching sessions.');
    if (!(await mayChangeSession())) { event.detail.resolve(false); return; }
    if (getWorkspace() !== entry.cwd && !selectWorkspace(entry.cwd)) { event.detail.resolve(false); return; }
    snapshot(await api('/api/agent/open', { key: entry.key })); event.detail.resolve(true);
  } catch (error) { status(error.message); showWorkspaceError(error.message); event.detail.resolve(false); }
})() });
$('#agent-reload').addEventListener('click', () => action(async () => { status('Reloading…'); await api('/api/agent/reload', { key: state?.key }); }));
$('#agent-close').addEventListener('click', () => action(async () => {
  if ($('#agent-message').value.trim() && !confirm('Discard the unsent message and close the session?')) return;
  await api('/api/agent/close', { key: state?.key }); $('#agent-message').value = ''; draftSessionId = null;
}));
$('#agent-stop').addEventListener('click', () => action(async () => { status('Stopping…'); await api('/api/agent/stop', { key: state?.key }); }));
$('#agent-message').addEventListener('input', () => {
  if (!$('#agent-message').value.trim()) draftSessionId = null;
  else if (!draftSessionId) draftSessionId = state?.key ?? null;
  controls();
});
$('#agent-form').addEventListener('submit', (event) => { event.preventDefault(); void action(async () => {
  const message = $('#agent-message').value; if (!message.trim()) return;
  if (draftSessionId && draftSessionId !== state?.key) throw new Error('Draft belongs to another session; copy or clear it before sending.');
  if (!activeHere()) throw new Error('Open a session in this workspace before sending.');
  const context = { key: state?.key }; document.dispatchEvent(new CustomEvent('agent-document-context', { detail: context }));
  if (context.error) throw new Error(context.error);
  await api('/api/agent/send', { key: state?.key, message, document: context.path ?? null });
  if ($('#agent-message').value === message) { $('#agent-message').value = ''; draftSessionId = null; }
}); });
