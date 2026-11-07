import { syntaxTree } from '@codemirror/language'
import { StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'

// Split table cells without treating escaped pipes, inline-code pipes, or
// Obsidian wikilink aliases as column separators. This is preview-only.
function splitRow(line) {
  let text = line.trim()
  if (!text.startsWith('|')) return null
  text = text.slice(1)
  const cells = []
  let cell = '', wiki = false, codeTicks = 0, escaped = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (escaped) { cell += ch; escaped = false; continue }
    if (ch === '\\') { escaped = true; cell += ch; continue }
    if (!codeTicks && text.startsWith('[[', i)) { wiki = true; cell += '[['; i++; continue }
    if (!codeTicks && wiki && text.startsWith(']]', i)) { wiki = false; cell += ']]'; i++; continue }
    if (!wiki && ch === '`') {
      let count = 1
      while (text[i + count] === '`') count++
      if (!codeTicks) codeTicks = count
      else if (count === codeTicks) codeTicks = 0
      cell += '`'.repeat(count); i += count - 1; continue
    }
    if (ch === '|' && !wiki && !codeTicks) { cells.push(cell.trim()); cell = ''; continue }
    cell += ch
  }
  if (cell.trim()) cells.push(cell.trim())
  return cells
}

function insideFencedCode(state, pos) {
  let node = syntaxTree(state).resolveInner(pos, 1)
  while (node) {
    if (node.name === 'FencedCode' || node.name === 'CodeBlock') return true
    node = node.parent
  }
  return false
}

function appendCellText(cell, value) {
  // DOM text nodes ensure note contents cannot inject HTML. Only line-break
  // tags are interpreted; all other syntax stays visible as plain text.
  const display = value.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\\\|/g, '|')
  display.split(/<br\s*\/?\s*>/i).forEach((part, index) => {
    if (index) cell.appendChild(document.createElement('br'))
    cell.appendChild(document.createTextNode(part))
  })
}

class TablePreview extends WidgetType {
  constructor(from, source, headers, rows) { super(); this.from = from; this.source = source; this.headers = headers; this.rows = rows }
  eq(other) { return this.from === other.from && this.source === other.source }
  toDOM(view) {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-table-fallback'
    const toolbar = document.createElement('div')
    toolbar.className = 'cm-table-toolbar'
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-table-toggle'
    button.textContent = 'Edit table source'
    button.addEventListener('click', () => { view.dispatch({ selection: { anchor: this.from }, scrollIntoView: true }); view.focus() })
    toolbar.appendChild(button)
    const table = document.createElement('table')
    const head = document.createElement('thead')
    const headRow = document.createElement('tr')
    for (const header of this.headers) { const cell = document.createElement('th'); appendCellText(cell, header); headRow.appendChild(cell) }
    head.appendChild(headRow); table.appendChild(head)
    const body = document.createElement('tbody')
    for (const row of this.rows) {
      const tr = document.createElement('tr')
      // Never silently drop extra cells from an irregular row in the preview.
      for (let i = 0; i < Math.max(this.headers.length, row.length); i++) { const cell = document.createElement('td'); appendCellText(cell, row[i] ?? ''); tr.appendChild(cell) }
      body.appendChild(tr)
    }
    table.appendChild(body); wrapper.append(toolbar, table)
    return wrapper
  }
  ignoreEvent() { return true }
}

function decorations(state) {
  const ranges = []
  for (let n = 1; n < state.doc.lines; n++) {
    const line = state.doc.line(n)
    if (!line.text.trimStart().startsWith('|')) continue
    const headers = splitRow(line.text)
    const separator = splitRow(state.doc.line(n + 1).text)
    if (!headers?.length || !separator?.length || headers.length === separator.length || !separator.every(cell => /^:?-{3,}:?$/.test(cell))) continue
    if (insideFencedCode(state, line.from)) continue
    const rows = []
    let last = n + 1
    while (last < state.doc.lines) {
      const row = splitRow(state.doc.line(last + 1).text)
      if (!row) break
      rows.push(row); last++
    }
    const end = state.doc.line(last).to
    if (!state.selection.ranges.some(range => range.from <= end && range.to >= line.from)) {
      ranges.push(Decoration.replace({ widget: new TablePreview(line.from, state.doc.sliceString(line.from, end), headers, rows), block: true }).range(line.from, end))
    }
    n = last
  }
  return Decoration.set(ranges, true)
}

export const nonstandardTablePreview = StateField.define({
  create: decorations,
  update(value, tr) { return tr.docChanged || tr.selection || tr.reconfigured ? decorations(tr.state) : value },
  provide: field => EditorView.decorations.from(field),
})

export const nonstandardTableTheme = EditorView.baseTheme({
  '.cm-table-fallback': { display: 'block', overflowX: 'auto' },
  '.cm-table-fallback table': { borderCollapse: 'collapse', width: '100%' },
  '.cm-table-fallback th, .cm-table-fallback td': { border: '1px solid var(--vscode-panel-border, var(--vscode-editor-foreground))', padding: '8px 12px', textAlign: 'left', verticalAlign: 'top' },
  '.cm-table-fallback th': { backgroundColor: 'var(--vscode-textCodeBlock-background, var(--vscode-editor-background))' },
})
