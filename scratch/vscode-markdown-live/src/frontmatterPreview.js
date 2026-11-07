import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'

const setCollapsed = StateEffect.define()

function frontmatter(state) {
  if (state.doc.lines < 2 || state.doc.line(1).text.replace(/^\uFEFF/, '').trim() !== '---') return null
  for (let number = 2; number <= state.doc.lines; number++) {
    const line = state.doc.line(number)
    if (line.text.trim() === '---') return { from: 0, to: line.to, close: line.from }
  }
  return null
}

class FrontmatterControl extends WidgetType {
  constructor(collapsed, end) { super(); this.collapsed = collapsed; this.end = end }
  eq(other) { return this.collapsed === other.collapsed && this.end === other.end }
  toDOM(view) {
    const wrapper = document.createElement('div')
    wrapper.className = this.collapsed ? 'cm-frontmatter-collapsed' : 'cm-frontmatter-control'
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'cm-frontmatter-toggle'
    button.textContent = this.collapsed ? 'Show properties' : 'Hide properties'
    button.setAttribute('aria-expanded', String(!this.collapsed))
    button.addEventListener('click', () => {
      const selection = !this.collapsed && view.state.selection.ranges.some(range => range.from <= this.end)
        ? { anchor: Math.min(this.end + 1, view.state.doc.length) } : undefined
      view.dispatch({ effects: setCollapsed.of(!this.collapsed), selection })
    })
    wrapper.appendChild(button)
    return wrapper
  }
  ignoreEvent() { return true }
}

function render(state, collapsed) {
  const bounds = frontmatter(state)
  if (!bounds) return Decoration.none
  if (collapsed) {
    return Decoration.set([Decoration.replace({ widget: new FrontmatterControl(true, bounds.to), block: true }).range(bounds.from, bounds.to)])
  }
  return Decoration.set([
    Decoration.widget({ widget: new FrontmatterControl(false, bounds.to), block: true, side: -1 }).range(0),
    Decoration.line({ class: 'cm-frontmatter-delimiter' }).range(0),
    Decoration.line({ class: 'cm-frontmatter-delimiter' }).range(bounds.close),
  ], true)
}

export const frontmatterPreview = StateField.define({
  create(state) { return { collapsed: false, decorations: render(state, false) } },
  update(value, tr) {
    let collapsed = value.collapsed
    for (const effect of tr.effects) if (effect.is(setCollapsed)) collapsed = effect.value
    if (tr.docChanged && !frontmatter(tr.state)) collapsed = false
    if (!tr.docChanged && collapsed === value.collapsed) return value
    return { collapsed, decorations: render(tr.state, collapsed) }
  },
  provide: field => EditorView.decorations.from(field, value => value.decorations),
})

export const frontmatterTheme = EditorView.baseTheme({
  '.cm-frontmatter-delimiter .cm-formatting-block': { opacity: '1 !important', fontSize: 'inherit !important', color: 'var(--vscode-editor-foreground)' },
  '.cm-frontmatter-control, .cm-frontmatter-collapsed': { padding: '4px 4px 8px' },
  '.cm-frontmatter-toggle': { color: 'var(--vscode-textLink-foreground, var(--vscode-editor-foreground))', background: 'transparent', border: '0', padding: '4px 0', cursor: 'pointer', font: 'inherit' },
  '.cm-frontmatter-toggle:focus-visible': { outline: '1px solid var(--vscode-focusBorder, currentColor)' },
})
