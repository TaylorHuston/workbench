import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { livePreviewPlugin, markdownStylePlugin, mouseSelectingField, editorTheme } from 'codemirror-live-markdown';
import './style.css';
import './agent.js';

const $ = (selector) => document.querySelector(selector);
const themePreference = window.matchMedia('(prefers-color-scheme: dark)');
let chosenTheme;
try { chosenTheme = localStorage.getItem('pi-workbench-theme'); } catch { /* Use the system preference. */ }
if (chosenTheme !== 'light' && chosenTheme !== 'dark') chosenTheme = null;
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('#theme-toggle').setAttribute('aria-pressed', String(theme === 'dark'));
}
applyTheme(chosenTheme ?? (themePreference.matches ? 'dark' : 'light'));
themePreference.addEventListener('change', (event) => { if (!chosenTheme) applyTheme(event.matches ? 'dark' : 'light'); });
$('#theme-toggle').addEventListener('click', () => {
  chosenTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('pi-workbench-theme', chosenTheme); } catch { /* Keep the choice for this page. */ }
  applyTheme(chosenTheme);
});
let view, current, original = '', version, ending = 'lf', saving = false, opening = false, managing = false;
let selected = { path: '', kind: 'directory' };
const containers = new Map([['', $('#tree')]]);
const parentOf = (path) => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
const containsCurrent = (path) => current && (current === path || current.startsWith(`${path}/`));
function select(path, kind) {
  if (managing) return;
  selected = { path, kind };
  $('#selection').textContent = `Selected: ~/.pi${path ? `/${path}` : ''}`;
  $('#selection').title = $('#selection').textContent;
  $('#rename').disabled = $('#trash').disabled = !path;
  document.querySelectorAll('[data-entry]').forEach((entry) => entry.classList.toggle('selected', entry.dataset.entry === path));
  $('#select-root').classList.toggle('selected', !path);
}
select('', 'directory');
const normalize = (text) => text.replace(/\r\n/g, '\n');
function dirty() { return !!view && view.state.doc.toString() !== original; }
function updateStatus(message) {
  $('#status').textContent = message ?? (dirty() ? 'Unsaved changes' : current ? 'Saved' : '');
  $('#save').disabled = !current || !dirty() || saving;
}
async function api(url, options) {
  const response = await fetch(url, options); const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result;
}
async function loadTree(target, path = '') {
  target.textContent = 'Loading…';
  try {
    const entries = await api(`/api/list?path=${encodeURIComponent(path)}`); target.replaceChildren();
    for (const key of containers.keys()) if (key && (!path || key.startsWith(`${path}/`))) containers.delete(key);
    if (!entries.length) { const empty = document.createElement('span'); empty.className = 'tree-empty'; empty.textContent = 'No files'; target.append(empty); }
    for (const item of entries) {
      if (item.type === 'directory') {
        const details = document.createElement('details'); const summary = document.createElement('summary');
        const icon = document.createElement('span'); icon.className = 'folder-icon'; icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span'); label.textContent = item.name; summary.append(icon, label);
        summary.dataset.entry = item.path; summary.classList.toggle('selected', selected.path === item.path);
        summary.addEventListener('click', (event) => { if (managing) event.preventDefault(); else select(item.path, 'directory'); });
        const children = document.createElement('div'); children.className = 'children'; containers.set(item.path, children);
        details.append(summary, children); details.addEventListener('toggle', () => { if (details.open && !children.dataset.loaded) { children.dataset.loaded = 'yes'; loadTree(children, item.path); } }); target.append(details);
      } else {
        const button = document.createElement('button'); button.className = 'file'; button.textContent = item.name; button.title = item.path; button.dataset.entry = item.path;
        button.classList.toggle('selected', selected.path === item.path);
        button.addEventListener('click', () => openFile(item.path, button)); target.append(button);
      }
    }
  } catch (error) { target.textContent = error.message; }
}
async function openFile(path, button) {
  if (saving || opening || managing || (dirty() && !confirm('Discard unsaved changes and open another file?'))) return;
  const before = view?.state.doc.toString(); opening = true;
  try {
    updateStatus('Opening…'); const file = await api(`/api/file?path=${encodeURIComponent(path)}`);
    if (view && view.state.doc.toString() !== before) { updateStatus('Editor changed while opening; try again.'); return; }
    view?.destroy(); current = path; original = normalize(file.content); version = file.version; ending = file.lineEnding;
    $('#empty').hidden = true; $('#document').hidden = false; $('#filename').textContent = path.split('/').at(-1); $('#document-path').textContent = `~/.pi/${path}`; $('#path').textContent = ` / ${path}`;
    document.querySelectorAll('.file.active').forEach((node) => node.classList.remove('active')); button.classList.add('active'); select(path, 'file');
    view = new EditorView({ parent: $('#editor'), state: EditorState.create({ doc: original, extensions: [history(), keymap.of([...defaultKeymap, ...historyKeymap]), markdown({ extensions: [GFM] }), EditorView.lineWrapping, EditorView.contentAttributes.of({ 'aria-label': 'Markdown source editor' }), placeholder('Start writing…'), mouseSelectingField, livePreviewPlugin, markdownStylePlugin, editorTheme, EditorView.updateListener.of((update) => { if (update.docChanged) updateStatus(); })] }) });
    updateStatus();
  } catch (error) { updateStatus(error.message); } finally { opening = false; }
}
async function save() {
  if (!view || !current || !dirty() || saving || managing) return;
  const snapshot = view.state.doc.toString(); saving = true; updateStatus('Saving…');
  try {
    const content = ending === 'crlf' ? snapshot.replace(/\n/g, '\r\n') : snapshot;
    const result = await api('/api/file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: current, content, version }) });
    version = result.version; original = snapshot; saving = false; updateStatus();
  } catch (error) { saving = false; updateStatus(error.message); }
}
async function manage(action, kind) {
  if (managing || saving || opening) return;
  const target = { ...selected };
  const affectsEditor = action !== 'create' && containsCurrent(target.path);
  if (affectsEditor && dirty()) { $('#tree-status').textContent = 'Save or discard the open document before modifying it.'; return; }
  managing = true;
  if (affectsEditor && view) view.contentDOM.contentEditable = 'false';
  let name, itemVersion;
  try {
    if (action !== 'create') itemVersion = (await api(`/api/entry?path=${encodeURIComponent(target.path)}&kind=${target.kind}`)).version;
    if (action === 'create') {
      name = prompt(kind === 'file' ? 'New Markdown file name (include .md):' : 'New folder name:');
      if (name === null) return;
    } else if (action === 'rename') {
      name = prompt('New name:', target.path.split('/').at(-1));
      if (name === null) return;
    } else if (!confirm(`Move “${target.path}” to the macOS Trash?${target.kind === 'directory' ? '\nOnly empty folders can be moved.' : ''}`)) return;
    $('#tree-status').textContent = action === 'trash' ? 'Moving to Trash…' : 'Working…';
    const parent = action === 'create' ? (target.kind === 'directory' ? target.path : parentOf(target.path)) : parentOf(target.path);
    const payload = { action, path: target.path, kind: action === 'create' ? kind : target.kind, parent, name, version: itemVersion };
    const result = await api('/api/entry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (action === 'rename' && affectsEditor) {
      current = result.path + current.slice(target.path.length);
      $('#filename').textContent = current.split('/').at(-1); $('#document-path').textContent = `~/.pi/${current}`; $('#path').textContent = ` / ${current}`;
    }
    if (action === 'trash' && affectsEditor) {
      view?.destroy(); view = undefined; current = undefined; original = ''; version = undefined;
      $('#document').hidden = true; $('#empty').hidden = false; $('#path').textContent = ' / No file selected'; updateStatus();
    }
    managing = false;
    select(action === 'rename' ? result.path : parent, action === 'rename' ? target.kind : 'directory');
    const container = containers.get(parent);
    if (container && (parent === '' || container.closest('details')?.open)) await loadTree(container, parent);
    else if (container) { delete container.dataset.loaded; container.replaceChildren(); }
    $('#tree-status').textContent = action === 'trash' ? 'Moved to Trash.' : action === 'rename' ? 'Renamed.' : 'Created.';
  } catch (error) { $('#tree-status').textContent = error.message; }
  finally { managing = false; if (view) view.contentDOM.contentEditable = 'true'; }
}
$('#save').addEventListener('click', save);
$('#select-root').addEventListener('click', () => select('', 'directory'));
$('#new-file').addEventListener('click', () => manage('create', 'file'));
$('#new-folder').addEventListener('click', () => manage('create', 'directory'));
$('#rename').addEventListener('click', () => manage('rename'));
$('#trash').addEventListener('click', () => manage('trash'));
$('#refresh').addEventListener('click', () => { if (!managing) { select('', 'directory'); loadTree($('#tree')); } });
window.addEventListener('beforeunload', (event) => { if (dirty() || saving || managing || $('#agent-message').value.trim()) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); } });
loadTree($('#tree'));
