import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { livePreviewPlugin, markdownStylePlugin, mouseSelectingField, editorTheme } from 'codemirror-live-markdown';
import './style.css';

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
let view, current, original = '', version, ending = 'lf', saving = false, opening = false;
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
    if (!entries.length) { const empty = document.createElement('span'); empty.className = 'tree-empty'; empty.textContent = 'No files'; target.append(empty); }
    for (const item of entries) {
      if (item.type === 'directory') {
        const details = document.createElement('details'); const summary = document.createElement('summary');
        const icon = document.createElement('span'); icon.className = 'folder-icon'; icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span'); label.textContent = item.name; summary.append(icon, label);
        const children = document.createElement('div'); children.className = 'children';
        details.append(summary, children); details.addEventListener('toggle', () => { if (details.open && !children.dataset.loaded) { children.dataset.loaded = 'yes'; loadTree(children, item.path); } }); target.append(details);
      } else {
        const button = document.createElement('button'); button.className = 'file'; button.textContent = item.name; button.title = item.path;
        button.addEventListener('click', () => openFile(item.path, button)); target.append(button);
      }
    }
  } catch (error) { target.textContent = error.message; }
}
async function openFile(path, button) {
  if (saving || opening || (dirty() && !confirm('Discard unsaved changes and open another file?'))) return;
  const before = view?.state.doc.toString(); opening = true;
  try {
    updateStatus('Opening…'); const file = await api(`/api/file?path=${encodeURIComponent(path)}`);
    if (view && view.state.doc.toString() !== before) { updateStatus('Editor changed while opening; try again.'); return; }
    view?.destroy(); current = path; original = normalize(file.content); version = file.version; ending = file.lineEnding;
    $('#empty').hidden = true; $('#document').hidden = false; $('#filename').textContent = path.split('/').at(-1); $('#document-path').textContent = `~/.pi/${path}`; $('#path').textContent = ` / ${path}`;
    document.querySelectorAll('.file.active').forEach((node) => node.classList.remove('active')); button.classList.add('active');
    view = new EditorView({ parent: $('#editor'), state: EditorState.create({ doc: original, extensions: [history(), keymap.of([...defaultKeymap, ...historyKeymap]), markdown({ extensions: [GFM] }), EditorView.lineWrapping, EditorView.contentAttributes.of({ 'aria-label': 'Markdown source editor' }), placeholder('Start writing…'), mouseSelectingField, livePreviewPlugin, markdownStylePlugin, editorTheme, EditorView.updateListener.of((update) => { if (update.docChanged) updateStatus(); })] }) });
    updateStatus();
  } catch (error) { updateStatus(error.message); } finally { opening = false; }
}
async function save() {
  if (!view || !current || !dirty() || saving) return;
  const snapshot = view.state.doc.toString(); saving = true; updateStatus('Saving…');
  try {
    const content = ending === 'crlf' ? snapshot.replace(/\n/g, '\r\n') : snapshot;
    const result = await api('/api/file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: current, content, version }) });
    version = result.version; original = snapshot; saving = false; updateStatus();
  } catch (error) { saving = false; updateStatus(error.message); }
}
$('#save').addEventListener('click', save);
$('#refresh').addEventListener('click', () => loadTree($('#tree')));
window.addEventListener('beforeunload', (event) => { if (dirty() || saving) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); } });
loadTree($('#tree'));
