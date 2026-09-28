import { syntaxTree } from '@codemirror/language'
import type { EditorState, Range } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view'
import {
  checkUpdateAction,
  mouseSelectingField,
} from 'codemirror-live-markdown'

class ListMarkerWidget extends WidgetType {
  private readonly marker: string
  private readonly kind: 'bullet' | 'ordered' | 'source' | 'task'
  private readonly checked: boolean

  constructor(
    marker: string,
    kind: 'bullet' | 'ordered' | 'source' | 'task',
    checked = false,
  ) {
    super()
    this.marker = marker
    this.kind = kind
    this.checked = checked
  }

  eq(other: ListMarkerWidget) {
    return (
      this.marker === other.marker &&
      this.kind === other.kind &&
      this.checked === other.checked
    )
  }

  toDOM() {
    const marker = document.createElement('span')
    marker.className = `cm-list-marker cm-list-marker-${this.kind}`
    marker.setAttribute('aria-hidden', 'true')

    if (this.kind === 'task') {
      marker.classList.toggle('is-checked', this.checked)
      marker.textContent = this.checked ? '✓' : ''
    } else {
      marker.textContent = this.kind === 'bullet' ? '•' : this.marker
    }

    return marker
  }

  ignoreEvent() {
    return false
  }
}

function activeLines(state: EditorState) {
  const lines = new Set<number>()

  for (const range of state.selection.ranges) {
    const firstLine = state.doc.lineAt(range.from).number
    const lastLine = state.doc.lineAt(range.to).number

    for (let line = firstLine; line <= lastLine; line += 1) {
      lines.add(line)
    }
  }

  return lines
}

function frontmatterBoundary(state: EditorState) {
  if (state.doc.lines < 2 || state.doc.line(1).text.trim() !== '---') return 0

  for (let number = 2; number <= state.doc.lines; number += 1) {
    const line = state.doc.line(number)
    if (line.text.trim() === '---') return line.to
  }

  return 0
}

function buildListDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = []
  const selectedLines = activeLines(state)
  const isDragging = state.field(mouseSelectingField, false)
  const frontmatterEnd = frontmatterBoundary(state)

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name !== 'ListMark') return

      const line = state.doc.lineAt(node.from)
      if (selectedLines.has(line.number) || isDragging) return

      const marker = state.doc.sliceString(node.from, node.to)
      const followingText = state.doc.sliceString(node.to, line.to)
      const task = followingText.match(/^[ \t]+\[([ xX])\](?=[ \t]|$)/)

      if (node.from < frontmatterEnd) {
        decorations.push(
          Decoration.replace({
            widget: new ListMarkerWidget(marker, 'source'),
          }).range(node.from, node.to),
        )
        return
      }

      if (task) {
        decorations.push(
          Decoration.replace({
            widget: new ListMarkerWidget('', 'task', task[1].toLowerCase() === 'x'),
          }).range(node.from, node.to + task[0].length),
        )
        return
      }

      const ordered = /^\d+[.)]$/.test(marker)
      decorations.push(
        Decoration.replace({
          widget: new ListMarkerWidget(marker, ordered ? 'ordered' : 'bullet'),
        }).range(node.from, node.to),
      )
    },
  })

  return Decoration.set(decorations, true)
}

const listPreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildListDecorations(view.state)
    }

    update(update: Parameters<typeof checkUpdateAction>[0]) {
      if (checkUpdateAction(update) === 'rebuild') {
        this.decorations = buildListDecorations(update.state)
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
)

const listPreviewTheme = EditorView.baseTheme({
  '.cm-list-marker': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--accent)',
    fontFamily: 'var(--body-font)',
    fontWeight: '650',
    lineHeight: '1',
    verticalAlign: 'baseline',
  },
  '.cm-list-marker-bullet': {
    width: '1ch',
    fontSize: '1.05em',
  },
  '.cm-list-marker-ordered': {
    minWidth: '2ch',
    color: 'var(--muted)',
    fontVariantNumeric: 'tabular-nums',
  },
  '.cm-list-marker-source': {
    color: 'var(--muted)',
    fontFamily: 'var(--mono-font)',
    fontWeight: '400',
  },
  '.cm-list-marker-task': {
    width: '0.9em',
    height: '0.9em',
    border: '1.5px solid var(--rule-strong)',
    borderRadius: '2px',
    color: 'var(--paper)',
    fontSize: '0.72em',
    transform: 'translateY(0.08em)',
  },
  '.cm-list-marker-task.is-checked': {
    borderColor: 'var(--accent)',
    backgroundColor: 'var(--accent)',
  },
})

export const codeMirrorListPreview = [listPreviewPlugin, listPreviewTheme]
