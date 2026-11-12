import { EditorState, StateEffect } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { EditorView, ViewPlugin, keymap, placeholder } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { collapseOnSelectionFacet, livePreviewPlugin, markdownStylePlugin, mouseSelectingField, setMouseSelecting, tableEditorPlugin, editorTheme } from 'codemirror-live-markdown';
import { codeMirrorListPreview } from './markdown/listPreview.js';
import { inlineCodePreview } from './markdown/inlineCodePreview.js';
import { frontmatterPreview, frontmatterTheme } from './markdown/frontmatterPreview.js';
import { nonstandardTablePreview, nonstandardTableTheme } from './markdown/nonstandardTablePreview.js';
import { tableCellPreview } from './markdown/tableCellPreview.js';
import { getWorkspace, getDefaultWorkspace, getDefaultWorkspaceLabel, getWorkspaceName, showWorkspaceError } from './workspace.js';
import './style.css';
import './agent.js';

const $ = (selector) => document.querySelector(selector);
const themePreference = window.matchMedia('(prefers-color-scheme: dark)');
let chosenTheme;
try { chosenTheme = localStorage.getItem('pi-workbench-theme'); } catch { /* Use the system preference. */ }
if (chosenTheme !== 'light' && chosenTheme !== 'dark') chosenTheme = null;
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const toggle = $('#theme-toggle'), label = `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`;
  toggle.setAttribute('aria-pressed', String(theme === 'dark')); toggle.setAttribute('aria-label', label); toggle.title = label;
}
applyTheme(chosenTheme ?? (themePreference.matches ? 'dark' : 'light'));
themePreference.addEventListener('change', (event) => { if (!chosenTheme) applyTheme(event.matches ? 'dark' : 'light'); });
$('#theme-toggle').addEventListener('click', () => {
  chosenTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('pi-workbench-theme', chosenTheme); } catch { /* Keep the choice for this page. */ }
  applyTheme(chosenTheme);
});
let view, current, original = '', version, ending = 'lf', saving = false, opening = false, managing = false, stale = false, renaming = false, treeGeneration = 0;
let selected = { path: '', kind: 'directory' };
const containers = new Map([['', $('#tree')]]);
const parentOf = (path) => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
const normalize = (text) => text.replace(/\r\n/g, '\n');
const workspaceLabel = () => getWorkspace() === getDefaultWorkspace() ? getDefaultWorkspaceLabel() : getWorkspace() || '';
const displayPath = (path) => `${workspaceLabel()}${path ? `/${path}` : ''}`;
const query = (path, extra = {}) => new URLSearchParams({ workspace: getWorkspace(), path, ...extra }).toString();
function select(path, kind) {
  if (managing) return;
  selected = { path, kind };
  $('#selection').textContent = `Selected: ${displayPath(path)}`; $('#selection').title = $('#selection').textContent;
  document.querySelectorAll('[data-entry]').forEach((entry) => entry.classList.toggle('selected', entry.dataset.entry === path));
  $('#select-root').classList.toggle('selected', !path);
}
function dirty() { return !!view && view.state.doc.toString() !== original; }
function updateControls() {
  const working = saving || opening || managing || renaming;
  $('#save').disabled = $('#discard').disabled = !current || !dirty() || working;
  $('#trash').disabled = $('#filename').disabled = !current || dirty() || stale || working;
  $('#filename').title = dirty() ? 'Save or discard changes before renaming' : stale ? 'Reopen the changed file before renaming' : 'Rename file';
}
function updateStatus(message) {
  const text = message ?? (stale ? `File changed on disk.${dirty() ? ' Edits are unsaved.' : ''} Reopen it to load the latest version.` : dirty() ? 'Unsaved changes' : current ? 'Saved' : '');
  $('#status').textContent = current ? '' : text; $('#document-status').textContent = text; updateControls();
}
async function api(url, options) {
  const response = await fetch(url, options); const result = await response.json();
  if (!response.ok) { const error = new Error(result.error || 'Request failed'); error.status = response.status; throw error; }
  return result;
}
async function loadTree(target, path = '') {
  const workspace = getWorkspace(), generation = treeGeneration;
  if (!workspace) return;
  target.textContent = 'Loading…';
  try {
    const entries = await api(`/api/list?${query(path)}`);
    if (generation !== treeGeneration || workspace !== getWorkspace()) return;
    target.replaceChildren();
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
        details.append(summary, children); details.addEventListener('toggle', () => { if (details.open && !children.dataset.loaded) { children.dataset.loaded = 'yes'; void loadTree(children, item.path); } }); target.append(details);
      } else {
        const button = document.createElement('button'); button.className = 'file'; button.textContent = item.name; button.title = item.path; button.dataset.entry = item.path;
        button.classList.toggle('selected', selected.path === item.path);
        button.addEventListener('click', () => openFile(item.path, button)); target.append(button);
      }
    }
  } catch (error) { if (generation === treeGeneration && workspace === getWorkspace()) target.textContent = error.message; }
}
const mouseSelection = ViewPlugin.fromClass(class {
  constructor(editor) {
    this.editor = editor; this.disposed = false; this.dragging = false;
    this.down = () => { this.dragging = true; editor.dispatch({ effects: setMouseSelecting.of(true) }); };
    this.up = () => {
      if (!this.dragging) return; this.dragging = false;
      requestAnimationFrame(() => { if (!this.disposed && !this.dragging) editor.dispatch({ effects: setMouseSelecting.of(false) }); });
    };
    editor.contentDOM.addEventListener('mousedown', this.down);
    editor.dom.ownerDocument.addEventListener('mouseup', this.up);
  }
  destroy() { this.disposed = true; this.editor.contentDOM.removeEventListener('mousedown', this.down); this.editor.dom.ownerDocument.removeEventListener('mouseup', this.up); }
});
function clearDocument() {
  view?.destroy(); view = undefined; current = undefined; original = ''; version = undefined; stale = false;
  $('#document').hidden = true; $('#empty').hidden = false; updateStatus();
}
async function openFile(path, button) {
  if (saving || opening || managing || renaming || (dirty() && !confirm('Discard unsaved changes and open another file?'))) return;
  const before = view?.state.doc.toString(); opening = true;
  try {
    updateStatus('Opening…'); const file = await api(`/api/file?${query(path)}`);
    if (view && view.state.doc.toString() !== before) { updateStatus('Editor changed while opening; try again.'); return; }
    view?.destroy(); current = path; original = normalize(file.content); version = file.version; ending = file.lineEnding; stale = false;
    $('#empty').hidden = true; $('#document').hidden = false; $('#filename').textContent = path.split('/').at(-1); $('#document-path').textContent = displayPath(path);
    document.querySelectorAll('.file.active').forEach((node) => node.classList.remove('active')); button.classList.add('active'); select(path, 'file');
    const state = EditorState.create({ doc: original, extensions: [history(), keymap.of([...defaultKeymap, ...historyKeymap]), markdown({ extensions: [GFM] }), EditorView.lineWrapping, EditorView.contentAttributes.of({ 'aria-label': 'Markdown source editor' }), placeholder('Start writing…'), collapseOnSelectionFacet.of(true), mouseSelectingField, mouseSelection, livePreviewPlugin, markdownStylePlugin, codeMirrorListPreview, inlineCodePreview, frontmatterPreview, frontmatterTheme, nonstandardTablePreview, nonstandardTableTheme, tableCellPreview, editorTheme, EditorView.updateListener.of((update) => { if (update.docChanged) updateStatus(); })] });
    // Let the upstream table field see the complete initial syntax tree, including long documents.
    ensureSyntaxTree(state, state.doc.length, 500);
    view = new EditorView({ parent: $('#editor'), state: state.update({ effects: StateEffect.appendConfig.of(tableEditorPlugin()) }).state });
    // Upstream cell editing can rewrite and lose Markdown; preview only until round-tripping is safe.
    const blockTableEdit = (event) => {
      if (!(event.target instanceof Element) || !event.target.closest('.cm-table-cell')) return;
      event.preventDefault();
      if (event.type === 'mousedown') updateStatus('Table cells are read-only. Use the MD button to edit the source.');
    };
    for (const event of ['mousedown', 'beforeinput', 'paste', 'drop']) view.dom.addEventListener(event, blockTableEdit, true);
    updateStatus();
  } catch (error) { updateStatus(error.message); } finally { opening = false; updateControls(); }
}
async function save() {
  if (!view || !current || !dirty() || saving || opening || managing || renaming) return;
  const snapshot = view.state.doc.toString(); saving = true; updateStatus('Saving…');
  try {
    const content = ending === 'crlf' ? snapshot.replace(/\n/g, '\r\n') : snapshot;
    const result = await api('/api/file', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace: getWorkspace(), path: current, content, version }) });
    version = result.version; original = snapshot; stale = false; saving = false; updateStatus();
  } catch (error) { if (error.status === 409) stale = true; saving = false; updateStatus(error.message); }
}
function discard() {
  if (!view || !current || !dirty() || saving || opening || managing || renaming) return;
  if (!confirm('Discard unsaved changes and restore the last loaded or saved version?')) return;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: original } }); updateStatus();
}
async function inspectCurrent() {
  const result = await api(`/api/entry?${query(current, { kind: 'file' })}`);
  if (!result.version.endsWith(`:${version}`)) { stale = true; throw new Error('File changed on disk. Reopen it before renaming or moving it to Trash.'); }
  return result.version;
}
async function refreshParent(parent) {
  const container = containers.get(parent);
  if (container && (parent === '' || container.closest('details')?.open)) await loadTree(container, parent);
  else if (container) { delete container.dataset.loaded; container.replaceChildren(); }
}
function endRename() {
  renaming = false; $('#rename-input').hidden = true; $('#filename').hidden = false; updateControls();
}
function beginRename() {
  if (!current || dirty() || stale || saving || opening || managing || renaming) return;
  renaming = true; $('#filename').hidden = true; const input = $('#rename-input'); input.value = current.split('/').at(-1); input.hidden = false;
  updateControls(); input.focus(); input.select();
}
async function finishRename() {
  if (!renaming || managing) return;
  const name = $('#rename-input').value, path = current, parent = parentOf(path);
  if (name === path.split('/').at(-1)) { endRename(); return; }
  managing = true; $('#rename-input').disabled = true; updateControls();
  try {
    const itemVersion = await inspectCurrent();
    const result = await api('/api/entry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace: getWorkspace(), action: 'rename', path, kind: 'file', name, version: itemVersion }) });
    current = result.path; $('#filename').textContent = current.split('/').at(-1); $('#document-path').textContent = displayPath(current);
    managing = false; endRename(); select(current, 'file'); await refreshParent(parent); updateStatus('Renamed');
  } catch (error) { updateStatus(error.message); if (stale) endRename(); }
  finally { managing = false; $('#rename-input').disabled = false; updateControls(); if (renaming) $('#rename-input').focus(); }
}
async function trashCurrent() {
  if (!current || dirty() || stale || saving || opening || managing || renaming) return;
  const path = current, parent = parentOf(path);
  if (!confirm(`Move “${path}” to the macOS Trash?`)) return;
  managing = true; updateControls();
  try {
    const itemVersion = await inspectCurrent();
    await api('/api/entry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace: getWorkspace(), action: 'trash', path, kind: 'file', version: itemVersion }) });
    clearDocument(); managing = false; select(parent, 'directory'); await refreshParent(parent); $('#tree-status').textContent = 'Moved to Trash.';
  } catch (error) { updateStatus(error.message); }
  finally { managing = false; updateControls(); }
}
async function create(kind) {
  if (!getWorkspace() || managing || saving || opening || renaming) return;
  const target = { ...selected }; managing = true; updateControls();
  try {
    const name = prompt(kind === 'file' ? 'New Markdown file name (include .md):' : 'New folder name:'); if (name === null) return;
    $('#tree-status').textContent = 'Working…';
    const parent = target.kind === 'directory' ? target.path : parentOf(target.path);
    await api('/api/entry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace: getWorkspace(), action: 'create', kind, parent, name }) });
    managing = false; select(parent, 'directory'); await refreshParent(parent); $('#tree-status').textContent = 'Created.';
  } catch (error) { $('#tree-status').textContent = error.message; }
  finally { managing = false; updateControls(); }
}
document.addEventListener('workspace-before-change', (event) => {
  if (event.defaultPrevented) return;
  if (saving || opening || managing || renaming) { showWorkspaceError('Finish the current file operation before switching workspaces.'); event.preventDefault(); }
  else if (dirty() && !confirm('Discard unsaved changes and switch workspaces?')) event.preventDefault();
});
document.addEventListener('workspace-change', () => {
  treeGeneration++; clearDocument(); containers.clear(); containers.set('', $('#tree')); selected = { path: '', kind: 'directory' };
  const path = getWorkspace(); $('#new-file').disabled = $('#new-folder').disabled = !path;
  $('#root-name').textContent = getWorkspaceName() || path;
  $('#select-root').title = path; $('#tree-status').textContent = ''; select('', 'directory'); void loadTree($('#tree'));
});
document.addEventListener('workspace-label-change', () => { if (getWorkspace()) $('#root-name').textContent = getWorkspaceName() || getWorkspace(); });
$('#save').addEventListener('click', save);
$('#discard').addEventListener('click', discard);
$('#trash').addEventListener('click', trashCurrent);
$('#filename').addEventListener('click', beginRename);
$('#rename-input').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); void finishRename(); }
  else if (event.key === 'Escape') { event.preventDefault(); if (!managing) endRename(); }
});
$('#rename-input').addEventListener('blur', () => { if (renaming && !managing && $('#rename-input').value === current?.split('/').at(-1)) endRename(); });
$('#select-root').addEventListener('click', () => select('', 'directory'));
$('#new-file').addEventListener('click', () => create('file'));
$('#new-folder').addEventListener('click', () => create('directory'));
$('#refresh').addEventListener('click', () => { if (!managing) { select('', 'directory'); void loadTree($('#tree')); } });
window.addEventListener('beforeunload', (event) => { if (dirty() || saving || managing || (renaming && $('#rename-input').value !== current?.split('/').at(-1)) || $('#agent-message').value.trim()) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('keydown', (event) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save(); } });
