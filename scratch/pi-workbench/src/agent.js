const $ = (selector) => document.querySelector(selector);
let state = null, live = null, lastError = '', draftSessionId = null;

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
  const running = !!state?.busy, open = !!state;
  $('#agent-close').disabled = !open || running;
  document.querySelectorAll('.session-button').forEach((button) => {
    button.disabled = running;
    if (button.dataset.key === state?.key) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
  $('#agent-send').disabled = !open || running || !state.model; $('#agent-message').disabled = !open || running || !state.model;
  $('#agent-stop').disabled = !running;
  $('#agent-model').textContent = open ? `${state.model ?? 'No model available'} · ${state.cwd} · Tools: ${state.tools.length ? state.tools.join(', ') : 'none'}` : 'No session open';
}
function snapshot(value) {
  state = value; live = null; $('#agent-transcript').replaceChildren();
  if (!state) {
    const p = document.createElement('p'); p.className = 'agent-placeholder'; p.textContent = 'Choose a saved session in the sidebar.'; $('#agent-transcript').append(p);
  } else {
    for (const message of state.messages) row(message.role, message.text);
    if (state.partial) live = row('assistant', state.partial);
  }
  controls();
  if ($('#agent-message').value.trim() && draftSessionId && state?.key !== draftSessionId) status('Draft belongs to another session; copy or clear it before sending.');
  else if (!lastError) status(state?.busy ? 'Running…' : state?.warning || (state ? 'Ready' : ''));
}
const events = new EventSource('/api/agent/events');
events.onmessage = ({ data }) => {
  const event = JSON.parse(data);
  if (event.type === 'snapshot') snapshot(event.value);
  else if (event.type === 'busy' && state) { state.busy = event.value; lastError = ''; controls(); status('Running…'); }
  else if (event.type === 'delta') { if (!live) live = row('assistant', ''); live.textContent += event.text; $('#agent-transcript').scrollTop = $('#agent-transcript').scrollHeight; }
  else if (event.type === 'message') { if (event.value.role === 'assistant' && live) { live.parentElement.remove(); live = null; } row(event.value.role, event.value.text); }
  else if (event.type === 'tool') status(`${event.phase === 'start' ? 'Running' : event.isError ? 'Failed' : 'Finished'} tool: ${event.name}`);
  else if (event.type === 'error') { lastError = event.message; status(lastError); }
  else if (event.type === 'archives_changed' && sessionsLoaded) { applyArchiveChange(event.key, event.archived); }
};
events.onerror = () => status('Disconnected; reconnecting…');
events.onopen = () => { lastError = ''; status(state?.busy ? 'Running…' : state?.warning || (state ? 'Ready' : '')); if (sessionsLoaded) void loadSessions(); };

async function action(fn) { try { lastError = ''; await fn(); } catch (error) { lastError = error.message; status(lastError); } }
function showView(sessions) {
  $('#files-view').hidden = sessions; $('#agent-view').hidden = !sessions;
  $('#explorer-panel').hidden = sessions; $('#sessions-panel').hidden = !sessions;
  $('#files-tab').setAttribute('aria-pressed', String(!sessions)); $('#agent-tab').setAttribute('aria-pressed', String(sessions));
}
let sessionsLoaded = false, listGeneration = 0, cachedSessions = [];
const archiveVersions = new Map(), sessionGroupOpen = new Map();
function applyArchiveChange(key, archived) {
  if (!cachedSessions.some((session) => session.key === key)) { void loadSessions(); return; }
  archiveVersions.set(key, (archiveVersions.get(key) ?? 0) + 1);
  listGeneration++;
  cachedSessions = cachedSessions.map((session) => session.key === key ? { ...session, archived } : session);
  renderSessions();
}
function renderSessionGroups(parent, sessions) {
  const groups = new Map();
  for (const session of sessions) {
    const cwd = session.cwd || 'Unknown working directory';
    if (!groups.has(cwd)) groups.set(cwd, []);
    groups.get(cwd).push(session);
  }
  let first = true;
  for (const [cwd, entries] of groups) {
    const group = document.createElement('details'); group.className = 'session-group';
    const groupKey = `${entries[0].archived ? 'archived' : 'visible'}:${cwd}`;
    group.open = sessionGroupOpen.get(groupKey) ?? first; first = false;
    group.addEventListener('toggle', () => sessionGroupOpen.set(groupKey, group.open));
    const summary = document.createElement('summary'); summary.textContent = cwd; summary.title = cwd; group.append(summary);
    for (const entry of entries) {
      const container = document.createElement('div'); container.className = 'session-row';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'session-button'; button.dataset.key = entry.key;
      const title = document.createElement('span'); title.className = 'session-title'; title.textContent = entry.name; button.title = entry.name;
      const modified = document.createElement('small'); modified.className = 'session-date';
      const date = new Date(entry.modified); modified.textContent = Number.isNaN(date.valueOf()) ? '' : date.toLocaleString();
      button.append(title, modified);
      button.addEventListener('click', () => action(async () => {
        if (state?.key === entry.key) return;
        if ($('#agent-message').value.trim()) throw new Error('Copy or clear the unsent message before switching sessions.');
        status('Opening…'); await api('/api/agent/open', { key: entry.key });
      }));
      const archive = document.createElement('button'); archive.type = 'button'; archive.className = 'session-archive';
      archive.textContent = entry.archived ? 'Restore' : 'Archive'; archive.setAttribute('aria-label', `${archive.textContent} ${entry.name}`);
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
      container.append(button, archive); group.append(container);
    }
    parent.append(group);
  }
}
function renderSessions() {
  const list = $('#session-list'); const notice = $('#session-list-status');
  const wasExpanded = list.querySelector('.archived-sessions')?.open ?? false;
  list.replaceChildren();
  const visible = cachedSessions.filter((session) => !session.archived), archived = cachedSessions.filter((session) => session.archived);
  if (!visible.length && archived.length) { const empty = document.createElement('p'); empty.className = 'tree-empty'; empty.textContent = 'No visible sessions.'; list.append(empty); }
  renderSessionGroups(list, visible);
  if (archived.length) {
    const section = document.createElement('details'); section.className = 'archived-sessions'; section.open = wasExpanded;
    const summary = document.createElement('summary'); summary.textContent = `Archived (${archived.length})`; section.append(summary);
    renderSessionGroups(section, archived); list.append(section);
  }
  controls(); notice.textContent = cachedSessions.length ? `${visible.length} visible · ${archived.length} archived` : 'No saved Pi sessions found.';
}
async function loadSessions() {
  const notice = $('#session-list-status'); const generation = ++listGeneration;
  notice.textContent = 'Loading sessions…';
  try {
    const sessions = await api('/api/agent/sessions');
    if (generation !== listGeneration) return;
    cachedSessions = sessions; sessionsLoaded = true; renderSessions();
  } catch (error) { if (generation === listGeneration) notice.textContent = error.message; }
}
$('#files-tab').addEventListener('click', () => showView(false));
$('#agent-tab').addEventListener('click', () => { showView(true); if (!sessionsLoaded) void loadSessions(); });
$('#session-refresh').addEventListener('click', () => { void loadSessions(); });
$('#agent-close').addEventListener('click', () => action(async () => {
  if ($('#agent-message').value.trim() && !confirm('Discard the unsent message and close the session?')) return;
  await api('/api/agent/close', { key: state?.key }); $('#agent-message').value = ''; draftSessionId = null;
}));
$('#agent-stop').addEventListener('click', () => action(async () => { status('Stopping…'); await api('/api/agent/stop', { key: state?.key }); }));
$('#agent-message').addEventListener('input', () => {
  if (!$('#agent-message').value.trim()) draftSessionId = null;
  else if (!draftSessionId) draftSessionId = state?.key ?? null;
});
$('#agent-form').addEventListener('submit', (event) => { event.preventDefault(); void action(async () => {
  const message = $('#agent-message').value; if (!message.trim()) return;
  if (draftSessionId && draftSessionId !== state?.key) throw new Error('Draft belongs to another session; copy or clear it before sending.');
  await api('/api/agent/send', { key: state?.key, message });
  if ($('#agent-message').value === message) { $('#agent-message').value = ''; draftSessionId = null; }
}); });
