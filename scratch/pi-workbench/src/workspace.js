const select = document.querySelector('#workspace-select');
const add = document.querySelector('#workspace-add');
const manage = document.querySelector('#workspace-manage');
const panel = document.querySelector('#workspace-manager');
const managerList = document.querySelector('#workspace-manager-list');
const notice = document.querySelector('#workspace-status');
let root = null, rootLabel = '', current = null, records = [], generation = 0;
const pending = new Set();

export const getWorkspace = () => current;
export const getDefaultWorkspace = () => root;
export const getDefaultWorkspaceLabel = () => rootLabel;
export const getWorkspaceName = () => current === root ? rootLabel : records.find((entry) => entry.path === current)?.name ?? current?.split('/').filter(Boolean).at(-1) ?? '';
export function showWorkspaceError(message) { notice.textContent = message; }
async function api(body) {
  const options = body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const response = await fetch('/api/agent/workspaces', options); const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Workspace request failed');
  return result;
}
export async function refreshWorkspaces() {
  const requested = ++generation;
  try {
    const result = await api();
    if (requested !== generation) return;
    records = result; render();
  } catch (error) { if (requested === generation) notice.textContent = error.message; }
}
function renderManager() {
  const expanded = managerList.querySelector('.archived-workspaces')?.open ?? false;
  managerList.replaceChildren();
  const available = records.filter((entry) => entry.path !== root);
  const active = available.filter((entry) => !entry.archived), archived = available.filter((entry) => entry.archived);
  if (!available.length) { const empty = document.createElement('p'); empty.className = 'workspace-manager-empty'; empty.textContent = 'No added workspaces.'; managerList.append(empty); }
  for (const entry of active) managerList.append(workspaceRow(entry));
  if (archived.length) {
    const section = document.createElement('details'); section.className = 'archived-workspaces'; section.open = expanded;
    const summary = document.createElement('summary'); summary.textContent = `Archived (${archived.length})`; section.append(summary);
    for (const entry of archived) section.append(workspaceRow(entry));
    managerList.append(section);
  }
}
function workspaceRow(entry) {
  const row = document.createElement('div'); row.className = 'workspace-manager-row';
  const details = document.createElement('div'); details.className = 'workspace-manager-details';
  const name = document.createElement('strong'); name.textContent = entry.name;
  const path = document.createElement('small'); path.textContent = entry.path; path.title = entry.path; details.append(name, path);
  const actions = document.createElement('div'); actions.className = 'workspace-manager-actions';
  const rename = document.createElement('button'); rename.type = 'button'; rename.textContent = 'Rename'; rename.setAttribute('aria-label', `Rename ${entry.name}`);
  rename.addEventListener('click', async () => {
    const name = prompt('Workspace name:', entry.name); if (name === null || name.trim() === entry.name) return;
    await update(entry, { name });
  });
  const archive = document.createElement('button'); archive.type = 'button'; archive.textContent = entry.archived ? 'Restore' : 'Archive'; archive.setAttribute('aria-label', `${archive.textContent} ${entry.name}`);
  archive.addEventListener('click', async () => {
    if (!entry.archived && entry.path === current && !change(root)) return;
    await update(entry, { archived: !entry.archived });
  });
  rename.disabled = archive.disabled = pending.has(entry.path);
  actions.append(rename, archive); row.append(details, actions); return row;
}
function render() {
  if (!root) return;
  const available = records.filter((entry) => entry.path !== root && !entry.archived).sort((a, b) => a.name.localeCompare(b.name) || a.path.localeCompare(b.path));
  const selected = records.find((entry) => entry.path === current);
  select.replaceChildren();
  const defaultOption = document.createElement('option'); defaultOption.value = root; defaultOption.textContent = rootLabel; defaultOption.title = root; select.append(defaultOption);
  for (const entry of available) {
    const option = document.createElement('option'); option.value = entry.path; option.textContent = entry.name; option.title = entry.path; select.append(option);
  }
  // Another browser can archive the selected workspace; keep it accessible until the user switches.
  if (current && current !== root && !available.some((entry) => entry.path === current)) {
    const option = document.createElement('option'); option.value = current; option.textContent = selected?.name ?? current.split('/').filter(Boolean).at(-1) ?? current; option.title = current; select.append(option);
    if (!notice.textContent) notice.textContent = 'This workspace is archived or unavailable; switch workspaces when ready.';
  }
  select.value = current ?? root; select.title = current ?? root;
  select.disabled = false; add.disabled = false; manage.disabled = false; renderManager();
  document.dispatchEvent(new CustomEvent('workspace-label-change'));
}
function change(next) {
  if (!current || next === current) { select.value = current ?? ''; return true; }
  const event = new CustomEvent('workspace-before-change', { cancelable: true, detail: { from: current, to: next } });
  if (!document.dispatchEvent(event)) { select.value = current; return false; }
  current = next; notice.textContent = ''; render();
  document.dispatchEvent(new CustomEvent('workspace-change', { detail: { workspace: next } })); return true;
}
async function update(entry, changes) {
  if (pending.has(entry.path)) return;
  pending.add(entry.path); notice.textContent = ''; render();
  try {
    const result = await api({ action: 'update', cwd: entry.path, changes, revision: entry.revision });
    // Invalidate older reads; don't overwrite a newer record delivered by another refresh.
    generation++;
    records = records.map((item) => item.path === entry.path && item.revision === entry.revision ? result.workspace : item);
    render(); await refreshWorkspaces();
  } catch (error) { notice.textContent = error.message; }
  finally { pending.delete(entry.path); render(); }
}
select.addEventListener('change', () => change(select.value));
manage.addEventListener('click', () => { panel.hidden = !panel.hidden; manage.setAttribute('aria-expanded', String(!panel.hidden)); });
add.addEventListener('click', async () => {
  const cwd = prompt('Workspace working directory (absolute path):'); if (cwd === null) return;
  const suggestion = cwd.replace(/\/+$/, '').split('/').at(-1) || cwd;
  const name = prompt('Workspace name:', suggestion); if (name === null) return;
  add.disabled = true; notice.textContent = '';
  try {
    const result = await api({ action: 'add', cwd, name });
    generation++;
    if (!records.some((entry) => entry.path === result.workspace.path)) records.push(result.workspace);
    render(); await refreshWorkspaces();
    const saved = records.find((entry) => entry.path === result.workspace.path) ?? result.workspace;
    if (saved.archived) notice.textContent = 'This workspace is archived. Restore it in Manage workspaces.';
    else change(saved.path);
  } catch (error) { notice.textContent = error.message; }
  finally { add.disabled = false; }
});
(async () => {
  try {
    const response = await fetch('/api/workspace-root'); const result = await response.json();
    if (!response.ok || typeof result.root !== 'string') throw new Error(result.error || 'Could not load the default workspace');
    root = current = result.root; rootLabel = typeof result.label === 'string' ? result.label : root; render();
    document.dispatchEvent(new CustomEvent('workspace-change', { detail: { workspace: current } }));
    await refreshWorkspaces();
  } catch (error) { notice.textContent = error.message; }
})();
