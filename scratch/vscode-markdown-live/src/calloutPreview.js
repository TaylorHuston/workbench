import { syntaxTree } from '@codemirror/language'
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view'
import { checkUpdateAction } from 'codemirror-live-markdown'

class CalloutLabel extends WidgetType {
  constructor(type, hasTitle) { super(); this.type = type; this.hasTitle = hasTitle }
  eq(other) { return this.type === other.type && this.hasTitle === other.hasTitle }
  toDOM() {
    const label = document.createElement('span')
    label.className = 'cm-callout-label'
    label.textContent = this.hasTitle ? '●' : `● ${this.type.charAt(0).toUpperCase()}${this.type.slice(1)}`
    return label
  }
  ignoreEvent() { return false }
}

function buildDecorations(state) {
  const decorations = []
  const decoratedLines = new Set()
  syntaxTree(state).iterate({ enter(node) {
    if (node.name !== 'Blockquote') return
    const first = state.doc.lineAt(node.from)
    const match = first.text.match(/^\s{0,3}>[ \t]*\[!([a-zA-Z0-9_-]+)\]([+-])?(?=[ \t]|$)/)
    if (!match) return
    const type = match[1].toLowerCase()
    const start = state.doc.lineAt(node.from).number
    const end = state.doc.lineAt(node.to).number
    for (let number = start; number <= end; number++) {
      if (decoratedLines.has(number)) continue
      decoratedLines.add(number)
      const line = state.doc.line(number)
      const role = number === start ? ' cm-callout-title' : ''
      decorations.push(Decoration.line({ class: `cm-callout-line cm-callout-${type}${role}` }).range(line.from))
    }
    const selected = state.selection.ranges.some(range => range.from <= first.to && range.to >= first.from)
    if (selected) return
    const tokenStart = first.from + match[0].indexOf('[!')
    const tokenEnd = first.from + match[0].length
    const hasTitle = Boolean(first.text.slice(match[0].length).trim())
    decorations.push(Decoration.replace({ widget: new CalloutLabel(type, hasTitle) }).range(tokenStart, tokenEnd))
  } })
  return Decoration.set(decorations, true)
}

export const calloutPreview = ViewPlugin.fromClass(class {
  constructor(view) { this.decorations = buildDecorations(view.state) }
  update(update) { if (checkUpdateAction(update) === 'rebuild') this.decorations = buildDecorations(update.state) }
}, { decorations: plugin => plugin.decorations })

export const calloutTheme = EditorView.baseTheme({
  '.cm-line.cm-callout-line': {
    borderLeft: '3px solid var(--vscode-textLink-foreground, currentColor)',
    backgroundColor: 'color-mix(in srgb, var(--vscode-textLink-foreground, currentColor) 10%, transparent)',
    paddingLeft: '12px',
  },
  '.cm-callout-title': { fontWeight: '600' },
  '.cm-callout-label': { color: 'var(--vscode-textLink-foreground, currentColor)' },
  '.cm-callout-warning, .cm-callout-caution, .cm-callout-danger, .cm-callout-error': {
    borderLeftColor: 'var(--vscode-editorWarning-foreground, var(--vscode-textLink-foreground, currentColor))',
    backgroundColor: 'color-mix(in srgb, var(--vscode-editorWarning-foreground, var(--vscode-textLink-foreground, currentColor)) 10%, transparent)',
  },
  '.cm-callout-warning .cm-callout-label, .cm-callout-caution .cm-callout-label, .cm-callout-danger .cm-callout-label, .cm-callout-error .cm-callout-label': {
    color: 'var(--vscode-editorWarning-foreground, var(--vscode-textLink-foreground, currentColor))',
  },
})
