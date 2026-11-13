import { getWorkspace, refreshWorkspaces, selectWorkspace, showWorkspaceError, workspaceAvailable } from './workspace.js';
import { extensionDialogEvent, extensionDialogsDisconnected } from './extension-dialogs.js';
import { renderChatMarkdown } from './chat-markdown.js';

const $ = (selector) => document.querySelector(selector);
let state = null, live = null, liveText = '', lastError = '', draftSessionId = null, pendingNew = false, editorSessionKey = null;
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
  const body = document.createElement('div'); body.className = 'message-body'; renderChatMarkdown(body, text); item.append(label, body); $('#agent-transcript').append(item);
  $('#agent-transcript').scrollTop = $('#agent-transcript').scrollHeight; return body;
}
function controls() {
  const running = !!state?.busy, reloading = !!state?.reloading, open = activeHere(), hasDraft = !!$('#agent-message').value.trim();
  const entry = open ? cachedSessions.find(item => item.key === state.key) : null;
  $('#agent-close').disabled = $('#agent-reload').disabled = $('#session-rename').disabled = !open || running || reloading;
  $('#session-archive-current').disabled = !open || running || reloading || !entry || !!entry.transient;
  $('#session-archive-current').textContent = entry?.archived ? 'Restore' : 'Archive';
  $('#session-manage').disabled = !getWorkspace() || !sessionsLoaded;
  $('#session-new').disabled = !getWorkspace() || running || reloading;
  $('#session-select').disabled = !getWorkspace() || running || reloading || !sessionsLoaded;
  $('#session-select').value = open ? state.key : '';
  $('#agent-send').disabled = !open || running || reloading || !state.model;
  $('#agent-message').disabled = running || reloading || (!open && !hasDraft) || (open && !state.model && !hasDraft);
  $('#agent-stop').disabled = !running; $('#agent-stop').hidden = !running; $('#agent-send').hidden = running;
  $('#agent-model').textContent = open ? state.model ?? 'No model available' : '';
  $('#agent-model').title = open ? `${state.cwd} · Tools: ${state.tools.length ? state.tools.join(', ') : 'none'}` : '';
}
function visibleWarning(message) {
  return (message || '').replace(/\b\d+ skill discovery warning\(s\)\.\s*/g, '').replace(/Global extensions are active\. Basic dialogs are supported; custom terminal UI is not\.\s*/g, '').trim();
}
function snapshot(value) {
  state = value; live = null; liveText = ''; $('#agent-transcript').replaceChildren();
  if (activeHere() && state.key !== editorSessionKey) {
    editorSessionKey = state.key;
    document.dispatchEvent(new CustomEvent('agent-session-change', { detail: { key: state.key, created: pendingNew } }));
  }
  if (!activeHere()) {
    const p = document.createElement('p'); p.className = 'agent-placeholder'; p.textContent = 'Choose or start a session in this workspace.'; $('#agent-transcript').append(p);
  } else {
    for (const message of state.messages) row(message.role, message.text);
    if (state.partial) { liveText = state.partial; live = row('assistant', liveText); }
  }
  controls();
  if ($('#agent-message').value.trim() && draftSessionId && state?.key !== draftSessionId) status('Draft belongs to another session; copy or clear it before sending.');
  else if (!lastError) status(state?.reloading ? 'Reloading…' : state?.busy ? 'Running…' : activeHere() ? visibleWarning(state.warning) || 'Ready' : '');
}
const events = new EventSource('/api/agent/events');
events.onmessage = ({ data }) => {
  const event = JSON.parse(data);
  if (event.type === 'snapshot') snapshot(event.value);
  else if (event.type === 'busy' && state) { state.busy = event.value; lastError = ''; controls(); status('Running…'); }
  else if (event.type === 'delta' && activeHere()) {
    if (!live) { liveText = ''; live = row('assistant', ''); }
    liveText += event.text; const target = live;
    if (!target.dataset.renderPending) {
      target.dataset.renderPending = 'true'; requestAnimationFrame(() => {
        delete target.dataset.renderPending;
        if (live !== target || !target.isConnected) return;
        renderChatMarkdown(target, liveText); $('#agent-transcript').scrollTop = $('#agent-transcript').scrollHeight;
      });
    }
  }
  else if (event.type === 'message' && activeHere()) { if (event.value.role === 'assistant' && live) { live.parentElement.remove(); live = null; liveText = ''; } row(event.value.role, event.value.text); }
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

async function action(fn) { try { lastError = ''; status(''); await fn(); } catch (error) { lastError = error.message; status(lastError); } }
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
function applyArchiveChange(key, archived) {
  if (!cachedSessions.some((session) => session.key === key)) { void loadSessions(); return; }
  archiveVersions.set(key, (archiveVersions.get(key) ?? 0) + 1); listGeneration++;
  cachedSessions = cachedSessions.map((session) => session.key === key ? { ...session, archived } : session);
  renderSessions();
}
async function changeArchived(entry, target) {
  const revision = archiveVersions.get(entry.key) ?? 0;
  $('#session-list-status').textContent = target ? 'Archiving…' : 'Restoring…';
  try {
    await api('/api/agent/archive', { key: entry.key, archived: target });
    if ((archiveVersions.get(entry.key) ?? 0) === revision) applyArchiveChange(entry.key, target);
  } catch (error) { $('#session-list-status').textContent = error.message; }
}
function renderSessions() {
  const list = $('#session-list'), notice = $('#session-list-status');
  const wasExpanded = list.querySelector('.archived-sessions')?.open ?? false;
  list.replaceChildren();
  const selected = cachedSessions.filter((session) => session.cwd === getWorkspace());
  const visible = selected.filter((session) => !session.archived), archived = selected.filter((session) => session.archived);
  const picker = $('#session-select'); picker.replaceChildren(new Option('Choose a session…', ''));
  for (const entry of visible) picker.add(new Option(entry.name, entry.key));
  if (activeHere() && !visible.some(entry => entry.key === state.key)) {
    const current = selected.find(entry => entry.key === state.key);
    picker.add(new Option(current?.archived ? `${current.name} (archived)` : current?.name || 'Current session', state.key));
  }
  if (archived.length) {
    const section = document.createElement('details'); section.className = 'archived-sessions'; section.open = wasExpanded;
    const summary = document.createElement('summary'); summary.textContent = `Archived (${archived.length})`; section.append(summary);
    for (const entry of archived) {
      const row = document.createElement('div'); row.className = 'session-row';
      const name = document.createElement('span'); name.className = 'session-title'; name.textContent = entry.name;
      const restore = document.createElement('button'); restore.type = 'button'; restore.className = 'session-archive'; restore.textContent = 'Restore'; restore.setAttribute('aria-label', `Restore ${entry.name}`);
      restore.addEventListener('click', async () => { restore.disabled = true; try { await changeArchived(entry, false); } finally { restore.disabled = false; } });
      row.append(name, restore); section.append(row);
    }
    list.append(section);
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
$('#session-manage').addEventListener('click', () => {
  const panel = $('#session-manager'); panel.hidden = !panel.hidden;
  $('#session-manage').setAttribute('aria-expanded', String(!panel.hidden));
  if (!panel.hidden) { lastError = ''; status(activeHere() ? visibleWarning(state.warning) || 'Ready' : ''); }
});
$('#session-refresh').addEventListener('click', () => { void refreshWorkspaces(); void loadSessions(); });
$('#session-rename').addEventListener('click', () => action(async () => {
  if (!activeHere() || state.busy || state.reloading) return;
  const key = state.key, oldName = cachedSessions.find(item => item.key === key)?.name || 'New session';
  const name = prompt('Session name:', oldName); if (name === null || name.trim() === oldName) return;
  const result = await api('/api/agent/rename', { key, name });
  cachedSessions = cachedSessions.map(item => item.key === key ? { ...item, name: result.name } : item); renderSessions();
  status('Session renamed.');
}));
$('#session-archive-current').addEventListener('click', async () => {
  const entry = activeHere() && cachedSessions.find(item => item.key === state.key);
  if (!entry || entry.transient || state.busy || state.reloading) return;
  const button = $('#session-archive-current'); button.disabled = true;
  try { await changeArchived(entry, !entry.archived); } finally { controls(); }
});
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
    // The initial event-stream snapshot may not have arrived yet. Do not try to
    // reacquire a session already owned by this Workbench process.
    if (getWorkspace() === entry.cwd) {
      const current = await api('/api/agent/state');
      if (current?.key === entry.key && current.cwd === entry.cwd) { snapshot(current); event.detail.resolve(true); return; }
    }
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
