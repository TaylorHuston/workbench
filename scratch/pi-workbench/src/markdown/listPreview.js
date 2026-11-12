// Adapted from the adjacent VS Code Markdown Live spike.
import { syntaxTree } from '@codemirror/language'
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view'
import { checkUpdateAction, mouseSelectingField } from 'codemirror-live-markdown'

class ListMarker extends WidgetType {
  constructor(marker, kind, checked = false) {
    super()
    this.marker = marker
    this.kind = kind
    this.checked = checked
  }
  eq(other) {
    return this.marker === other.marker && this.kind === other.kind && this.checked === other.checked
  }
  toDOM() {
    const element = document.createElement('span')
    element.className = `cm-list-marker cm-list-marker-${this.kind}`
    element.setAttribute('aria-hidden', 'true')
    if (this.kind === 'task') {
      element.classList.toggle('is-checked', this.checked)
      element.textContent = this.checked ? '✓' : ''
    } else {
      element.textContent = this.kind === 'bullet' ? '•' : this.marker
    }
    return element
  }
  ignoreEvent() { return false }
}

function buildDecorations(state) {
  const decorations = []
  const selected = new Set()
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number
    const last = state.doc.lineAt(range.to).number
    for (let line = first; line <= last; line++) selected.add(line)
  }
  const dragging = state.field(mouseSelectingField, false)
  // Markdown parsers may mistake YAML frontmatter lists for document lists.
  let frontmatterEnd = 0
  if (state.doc.lines > 1 && state.doc.line(1).text.replace(/^\uFEFF/, '').trim() === '---') {
    for (let n = 2; n <= state.doc.lines; n++) {
      const line = state.doc.line(n)
      if (line.text.trim() === '---') { frontmatterEnd = line.to; break }
    }
  }
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'ListMark') return
      const line = state.doc.lineAt(node.from)
      if (selected.has(line.number) || dragging) return
      const marker = state.doc.sliceString(node.from, node.to)
      const task = state.doc.sliceString(node.to, line.to).match(/^[ \t]+\[([ xX])\](?=[ \t]|$)/)
      let kind = /^\d+[.)]$/.test(marker) ? 'ordered' : 'bullet'
      let end = node.to
      if (node.from < frontmatterEnd) kind = 'source'
      else if (task) { kind = 'task'; end += task[0].length }
      decorations.push(Decoration.replace({ widget: new ListMarker(marker, kind, task?.[1].toLowerCase() === 'x') }).range(node.from, end))
    },
  })
  return Decoration.set(decorations, true)
}

const listPreview = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = buildDecorations(view.state) }
  update(update) {
    if (checkUpdateAction(update) === 'rebuild') this.decorations = buildDecorations(update.state)
  }
}, { decorations: plugin => plugin.decorations })

const listTheme = EditorView.baseTheme({
  '.cm-list-marker': { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', lineHeight: '1', verticalAlign: 'baseline' },
  '.cm-list-marker-bullet': { width: '1ch', fontSize: '1.05em' },
  '.cm-list-marker-ordered': { minWidth: '2ch', fontVariantNumeric: 'tabular-nums' },
  '.cm-list-marker-task': { width: '0.9em', height: '0.9em', border: '1px solid currentColor', borderRadius: '2px', fontSize: '0.72em', transform: 'translateY(0.08em)' },
})

export const codeMirrorListPreview = [listPreview, listTheme]
