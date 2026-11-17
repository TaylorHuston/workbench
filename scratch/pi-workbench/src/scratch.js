import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { history, historyKeymap, defaultKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { collapseOnSelectionFacet, livePreviewPlugin, markdownStylePlugin, editorTheme } from 'codemirror-live-markdown';
import { codeMirrorListPreview } from './markdown/listPreview.js';
import { inlineCodePreview } from './markdown/inlineCodePreview.js';
import { frontmatterPreview, frontmatterTheme } from './markdown/frontmatterPreview.js';

const $ = (selector) => document.querySelector(selector);
let activeKey = null, loadedKey = null, view, original = '', version, ending = 'lf', saving = false, loading = false, stale = false, selected = false, transient = false;
const normalize = (text) => text.replace(/\r\n/g, '\n');
export const scratchDirty = () => !!view && view.state.doc.toString() !== original;
export const scratchSelected = () => selected;
export function discardScratch() { if (view && scratchDirty()) { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: original } }); status(); } }
function status(message) {
  $('#scratch-status').textContent = message ?? (stale ? 'Scratch changed on disk; your edits are preserved.' : scratchDirty() ? 'Unsaved changes' : view ? 'Saved' : '');
  $('#scratch-warning').hidden = !transient;
  $('#scratch-save').disabled = !scratchDirty() || saving || loading || loadedKey !== activeKey;
  $('#scratch-discard').disabled = !scratchDirty() || saving || loading;
}
async function api(body) {
  const response = await fetch('/api/agent/scratch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || 'Scratch request failed'); error.status = response.status; throw error; }
  return data;
}
function render(file, key) {
  view?.destroy(); original = normalize(file.content); version = file.version; ending = file.lineEnding; loadedKey = key; stale = false;
  $('#scratch-path').textContent = file.path;
  view = new EditorView({ parent: $('#scratch-editor'), state: EditorState.create({ doc: original, extensions: [history(), keymap.of([...defaultKeymap, ...historyKeymap]), markdown({ extensions: [GFM] }), EditorView.lineWrapping, EditorView.contentAttributes.of({ 'aria-label': 'Scratch Markdown source editor' }), placeholder('Write or ask the agent to add notes…'), collapseOnSelectionFacet.of(true), livePreviewPlugin, markdownStylePlugin, codeMirrorListPreview, inlineCodePreview, frontmatterPreview, frontmatterTheme, editorTheme, EditorView.updateListener.of(update => { if (update.docChanged) status(); })] }) });
  status();
}
async function refresh() {
  if (!activeKey || loading || saving || (view && loadedKey !== activeKey && scratchDirty())) return;
  const key = activeKey, previous = view?.state.doc.toString(); let failure; loading = true; status('Checking scratch…');
  try {
    const file = await api({ key, action: 'open' });
    if (key !== activeKey) return;
    if (view && loadedKey === key && (view.state.doc.toString() !== previous || scratchDirty())) {
      if (file.version !== version) stale = true;
      return;
    }
    if (!view || loadedKey !== key || file.version !== version) render(file, key);
  } catch (error) { failure = error.message; }
  finally { loading = false; status(failure); if (activeKey && activeKey !== key && selected) void refresh(); }
}
export async function saveScratch() {
  if (!scratchDirty() || saving || loading || loadedKey !== activeKey) return false;
  const text = view.state.doc.toString(), key = loadedKey; let failure; saving = true; status('Saving…');
  try {
    const content = ending === 'crlf' ? text.replace(/\n/g, '\r\n') : text;
    const result = await api({ key, action: 'save', content, version });
    if (loadedKey !== key) return false;
    version = result.version; original = text; stale = false; return true;
  } catch (error) { if (error.status === 409) stale = true; failure = error.message; return false; }
  finally { saving = false; status(failure); }
}
export async function confirmScratchChange(allowed) {
  if (saving || loading) { status('Wait for the scratch operation to finish.'); return false; }
  if (!scratchDirty()) return true;
  const dialog = $('#session-change-dialog'), title = $('#session-change-title'), message = $('#session-change-message');
  if (dialog.open) return false;
  title.textContent = 'Unsaved scratch changes'; message.textContent = 'Save or discard scratch changes before switching sessions.';
  const key = loadedKey, editor = view;
  const choice = await new Promise(resolve => { dialog.returnValue = 'cancel'; dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true }); dialog.showModal(); });
  title.textContent = 'Unsaved document changes'; message.textContent = 'Save or discard your changes before switching sessions.';
  if (!allowed() || key !== loadedKey || editor !== view) return false;
  if (choice === 'save') return (await saveScratch()) && !scratchDirty() && allowed();
  if (choice !== 'discard') return false;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: original } }); status();
  return allowed();
}
export async function prepareScratchForSend(key) {
  if (loadedKey && loadedKey !== key && scratchDirty()) throw new Error('Scratch belongs to another session; copy or discard the unsaved changes first.');
  if (saving || loading) throw new Error('Wait for the scratch operation to finish, then send again.');
  if (scratchDirty() && (!(await saveScratch()) || scratchDirty())) throw new Error('Could not save scratch. Your edits are preserved; resolve the scratch conflict before sending.');
}
export function scratchContextError(key) {
  if (loadedKey && loadedKey !== key && scratchDirty()) return 'Scratch belongs to another session; copy or discard the unsaved changes first.';
  if (scratchDirty() || saving || loading) return 'Save or discard scratch changes before sending.';
  return null;
}
function setTab(scratch) {
  if (scratch && !activeKey) return;
  selected = scratch; $('#editor-panel').hidden = scratch; $('#scratch-panel').hidden = !scratch;
  $('#editor-tab').setAttribute('aria-selected', String(!scratch)); $('#scratch-tab').setAttribute('aria-selected', String(scratch));
  if (scratch) { void refresh(); requestAnimationFrame(() => view?.requestMeasure()); }
}
$('#editor-tab').addEventListener('click', () => setTab(false));
$('#scratch-tab').addEventListener('click', () => setTab(true));
$('#scratch-save').addEventListener('click', () => void saveScratch());
$('#scratch-discard').addEventListener('click', () => { if (view && scratchDirty() && confirm('Discard unsaved scratch changes?')) { view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: original } }); status(); if (stale || loadedKey !== activeKey) void refresh(); } });
document.addEventListener('agent-state', event => {
  const key = event.detail?.key ?? null;
  activeKey = key; transient = !!event.detail?.transient; $('#scratch-tab').disabled = !key; status();
  if (!key && !scratchDirty()) setTab(false);
  if (selected && key && (!view || loadedKey !== key || !event.detail.busy)) void refresh();
  if (loadedKey && loadedKey !== key && scratchDirty()) status('Scratch belongs to a previous session; copy your unsaved work.');
});
window.addEventListener('focus', () => { if (selected) void refresh(); });
window.addEventListener('beforeunload', event => { if (scratchDirty() || saving) { event.preventDefault(); event.returnValue = ''; } });
