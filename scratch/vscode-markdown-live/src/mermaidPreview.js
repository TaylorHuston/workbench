import { syntaxTree } from '@codemirror/language'
import { StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import mermaid from 'mermaid'

// Never enable Mermaid's loose mode or diagram click bindings for note content.
let nextId = 0

class MermaidWidget extends WidgetType {
  constructor(source, from) { super(); this.source = source; this.from = from }
  eq(other) { return this.source === other.source && this.from === other.from }
  toDOM(view) {
    const container = document.createElement('div')
    container.className = 'cm-mermaid-preview'
    const toolbar = document.createElement('div')
    toolbar.className = 'cm-mermaid-toolbar'
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Edit diagram source'
    button.addEventListener('click', () => {
      view.dispatch({ selection: { anchor: Math.min(this.from + 1, view.state.doc.length) }, scrollIntoView: true })
      view.focus()
    })
    toolbar.appendChild(button)
    const output = document.createElement('div')
    output.textContent = 'Rendering diagram…'
    container.append(toolbar, output)
    const id = `markdown-live-mermaid-${++nextId}`
    const dark = document.body.classList.contains('vscode-dark') || document.body.classList.contains('vscode-high-contrast')
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', htmlLabels: false, theme: dark ? 'dark' : 'default' })
    mermaid.render(id, this.source).then(({ svg }) => {
      if (!container.isConnected) return
      output.innerHTML = svg
      view.requestMeasure()
    }).catch(() => {
      if (!container.isConnected) return
      output.replaceChildren()
      const message = document.createElement('p')
      message.textContent = 'Diagram could not be rendered. Edit the source to fix it.'
      const source = document.createElement('pre')
      source.textContent = this.source
      output.append(message, source)
      view.requestMeasure()
    })
    return container
  }
  ignoreEvent() { return true }
}

function decorations(state) {
  const result = []
  syntaxTree(state).iterate({ enter(node) {
    if (node.name !== 'FencedCode') return
    const info = node.node.getChild('CodeInfo')
    if (!info || state.doc.sliceString(info.from, info.to).trim().toLowerCase() !== 'mermaid') return
    // Reveal the source when any selection intersects the fenced block.
    if (state.selection.ranges.some(range => range.from <= node.to && range.to >= node.from)) return
    const content = node.node.getChild('CodeText')
    const source = content ? state.doc.sliceString(content.from, content.to) : ''
    result.push(Decoration.replace({ widget: new MermaidWidget(source, node.from), block: true }).range(node.from, node.to))
  } })
  return Decoration.set(result, true)
}

export const mermaidPreview = StateField.define({
  create: decorations,
  update(value, transaction) {
    if (transaction.docChanged || transaction.selection || transaction.reconfigured) return decorations(transaction.state)
    return value
  },
  provide: field => EditorView.decorations.from(field),
})
