import { defaultKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { ensureSyntaxTree } from '@codemirror/language'
import { EditorState, Prec, StateEffect } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { GFM } from '@lezer/markdown'
import { codeMirrorListPreview } from './listPreview.js'
import { calloutPreview, calloutTheme } from './calloutPreview.js'
import { frontmatterPreview, frontmatterTheme } from './frontmatterPreview.js'
import { nonstandardTablePreview, nonstandardTableTheme } from './nonstandardTablePreview.js'
import { mermaidPreview } from './mermaidPreview.js'
import { findFragment } from './wikilinkFragment.cjs'
import { collapseOnSelectionFacet, livePreviewPlugin, markdownStylePlugin, mouseSelectingField, setMouseSelecting, tableEditorPlugin, codeBlockField, linkPlugin, editorTheme } from 'codemirror-live-markdown'

const vscode = acquireVsCodeApi()
const status = document.getElementById('status')
let view, shadow = '', inflight = null, conflict = false, newline = '\n', applying = false
let pendingNavigation = null, pendingJump = null, lastJumpId = null
function localText() { return view.state.doc.toString().replace(/\n/g, newline) }
function stop() {
  conflict = true
  status.className = 'visible'
  status.textContent = 'The document changed elsewhere or the edit could not be applied. Your local text remains below: copy it before reopening this editor. Changes here are not being saved.'
}
function sendNext() {
  if (!view || conflict || inflight) return
  const text = localText()
  if (text === shadow) {
    if (pendingNavigation) {
      const target = pendingNavigation
      pendingNavigation = null
      vscode.postMessage({ type: 'follow-wikilink', target, base: shadow })
    }
    runJump()
    return
  }
  inflight = text
  vscode.postMessage({ type: 'edit', base: shadow, text })
}
function runJump() {
  if (!pendingJump || !view || inflight || (!conflict && localText() !== shadow)) return
  const jump = pendingJump
  pendingJump = null
  if (jump.id === lastJumpId) { vscode.postMessage({ type: 'jump-result', id: jump.id }); return }
  lastJumpId = jump.id
  if (conflict) {
    status.className = 'visible'
    status.textContent = 'Resolve the edit conflict before following this link.'
  } else {
    const result = findFragment(view.state.doc.toString(), jump.fragment)
    if (result.kind === 'found') {
      status.className = ''
      status.textContent = ''
      view.dispatch({ selection: { anchor: result.position }, effects: EditorView.scrollIntoView(result.position, { y: 'center' }) })
      view.focus()
    } else {
      status.className = 'visible'
      status.textContent = result.kind === 'ambiguous' ? 'More than one heading or block matches this link.' : result.kind === 'missing' ? 'The linked heading or block was not found.' : 'This heading or block link is not supported.'
    }
  }
  vscode.postMessage({ type: 'jump-result', id: jump.id })
}
function followWikilink(target) {
  if (conflict) return
  status.className = ''
  status.textContent = ''
  pendingNavigation = target
  sendNext()
}
function install(text) {
  if (/\r\n/.test(text) && /(^|[^\r])\n/.test(text)) {
    status.className = 'visible'
    status.textContent = 'Mixed line endings are unsupported. Use the normal text editor for this file.'
    conflict = true
  }
  newline = text.includes('\r\n') ? '\r\n' : '\n'
  shadow = text
  const state = EditorState.create({
      doc: text.replace(/\r\n/g, '\n'),
      extensions: [
        markdown({ extensions: [GFM] }), EditorView.lineWrapping,
        keymap.of(defaultKeymap), collapseOnSelectionFacet.of(true), mouseSelectingField,
        livePreviewPlugin, markdownStylePlugin, codeMirrorListPreview, calloutPreview, calloutTheme, frontmatterPreview, frontmatterTheme, nonstandardTablePreview, nonstandardTableTheme, mermaidPreview, codeBlockField({ copyButton: false }), linkPlugin(), editorTheme,
        EditorView.contentAttributes.of({ 'aria-label': 'Markdown live editor' }),
        EditorView.updateListener.of(update => { if (update.docChanged && !applying) sendNext() }),
        Prec.high(EditorView.theme({
          '&': { color: 'var(--vscode-editor-foreground)', backgroundColor: 'var(--vscode-editor-background)' },
          '.cm-scroller': { fontFamily: 'var(--vscode-editor-font-family)', fontSize: 'var(--vscode-editor-font-size)', lineHeight: '1.7' },
          '.cm-content': { maxWidth: '800px', width: '100%', margin: '0 auto', padding: '32px 24px 80px' },
          '.cm-line': { padding: '0 4px' },
          '.cm-header-1, .cm-header-2, .cm-header-3, .cm-header-4, .cm-header-5, .cm-header-6, .cm-strong, .cm-emphasis': { color: 'var(--vscode-editor-foreground)' },
          '.cm-strikethrough, .cm-formatting-inline, .cm-formatting-block, .cm-codeblock-fence': { color: 'var(--vscode-descriptionForeground, var(--vscode-editor-foreground))' },
          '.cm-link, .cm-wikilink, .cm-link-widget, .cm-wikilink-widget, .cm-link-widget:hover': { color: 'var(--vscode-textLink-foreground, var(--vscode-editor-foreground))' },
          '.cm-code, .cm-codeblock-widget, .cm-table-editor th, .cm-table-widget th': { color: 'var(--vscode-editor-foreground)', backgroundColor: 'var(--vscode-textCodeBlock-background, var(--vscode-editor-background))' },
          '.cm-codeblock-widget [class*="hljs-"]': { color: 'var(--vscode-editor-foreground)' },
          '.cm-table-editor th, .cm-table-editor td, .cm-table-widget th, .cm-table-widget td': { borderColor: 'var(--vscode-panel-border, var(--vscode-editor-foreground))' },
          '.cm-table-toggle': { color: 'var(--vscode-button-foreground, var(--vscode-editor-foreground))', backgroundColor: 'var(--vscode-button-background, var(--vscode-editor-background))', borderColor: 'var(--vscode-panel-border, var(--vscode-editor-foreground))' },
          '.cm-mermaid-preview': { overflowX: 'auto', padding: '12px', backgroundColor: 'var(--vscode-textCodeBlock-background, var(--vscode-editor-background))', color: 'var(--vscode-editor-foreground)' },
          '.cm-mermaid-preview svg': { maxWidth: '100%', height: 'auto' },
          '.cm-mermaid-toolbar': { display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' },
          '.cm-mermaid-toolbar button': { color: 'var(--vscode-button-foreground)', backgroundColor: 'var(--vscode-button-background)', border: '0', padding: '4px 8px', cursor: 'pointer' },
          '.cm-cursor': { borderLeftColor: 'var(--vscode-editorCursor-foreground)' },
          '.cm-selectionBackground': { backgroundColor: 'var(--vscode-editor-selectionBackground) !important' },
        })),
      ],
    })
  // The table field only rebuilds on document changes; let it see the full
  // initial syntax tree instead of the parser's first viewport-sized slice.
  ensureSyntaxTree(state, state.doc.length, 500)
  view = new EditorView({
    parent: document.getElementById('editor'),
    state: state.update({ effects: StateEffect.appendConfig.of(tableEditorPlugin()) }).state,
  })
  // The upstream table editor serializes the entire table and can lose cells,
  // including unescaped wikilink pipes. Keep widgets read-only until it can
  // round-trip those tables safely; the MD button still opens source mode.
  const blockTableEdit = event => {
    if (!(event.target instanceof Element) || !event.target.closest('.cm-table-cell')) return
    event.preventDefault()
    if (event.type === 'mousedown') {
      status.className = 'visible'
      status.textContent = 'Table cells are read-only in this spike. Use the MD button to edit the original Markdown. Some wikilinks may not display correctly.'
    }
  }
  for (const eventName of ['mousedown', 'beforeinput', 'paste', 'drop']) {
    view.dom.addEventListener(eventName, blockTableEdit, true)
  }
  // Handle modifier mousedown before CodeMirror changes the selection and
  // replaces the preview widget with source, which otherwise loses the click.
  view.dom.addEventListener('mousedown', event => {
    const link = event.target instanceof Element ? event.target.closest('.cm-wikilink-widget, .cm-wikilink-source') : null
    if (!link || event.button !== 0 || !(event.metaKey || event.ctrlKey)) return
    const pos = view.posAtDOM(link, 0)
    const line = view.state.doc.lineAt(pos)
    // The upstream widget also matches embeds. Only a non-embed wikilink
    // whose source corresponds to this widget is eligible for navigation.
    for (const match of line.text.matchAll(/(!?)\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)) {
      const start = line.from + match.index + match[1].length
      const end = line.from + match.index + match[0].length
      if (pos >= start && pos <= end && !match[1]) {
        event.preventDefault()
        event.stopPropagation()
        followWikilink(match[2])
        break
      }
    }
  }, true)
  view.contentDOM.addEventListener('mousedown', () => view.dispatch({effects: setMouseSelecting.of(true)}))
  document.addEventListener('mouseup', () => requestAnimationFrame(() => view.dispatch({effects: setMouseSelecting.of(false)})))
}
window.addEventListener('message', event => {
  const message = event.data
  if (message.type === 'jump-to-fragment' && Number.isSafeInteger(message.id) && typeof message.fragment === 'string') {
    pendingJump = { id: message.id, fragment: message.fragment }
    runJump()
    return
  }
  if (message.type === 'navigation-error') {
    status.className = 'visible'
    status.textContent = message.message
    return
  }
  if (message.type === 'conflict') { pendingNavigation = null; stop(); runJump(); return }
  if (message.type === 'ack') {
    if (conflict) return
    if (inflight !== message.text) { stop(); return }
    shadow = message.text
    inflight = null
    sendNext()
    return
  }
  if (message.type !== 'document' || typeof message.text !== 'string') return
  if (!view) { install(message.text); runJump(); return }
  if (conflict || message.text === shadow || message.text === inflight) return
  if (inflight || localText() !== shadow) { stop(); return }
  const text = message.text
  if (/\r\n/.test(text) && /(^|[^\r])\n/.test(text)) { stop(); return }
  newline = text.includes('\r\n') ? '\r\n' : '\n'
  shadow = text
  applying = true
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text.replace(/\r\n/g, '\n') } })
  applying = false
})
vscode.postMessage({ type: 'ready' })
