import { syntaxTree } from '@codemirror/language'
import type { Range } from '@codemirror/state'
import type { SyntaxNodeRef } from '@lezer/common'
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
} from '@codemirror/view'
import {
  checkUpdateAction,
  mouseSelectingField,
  shouldShowSource,
} from 'codemirror-live-markdown'

const blockMarks = new Set(['HeaderMark', 'ListMark', 'QuoteMark'])
const inlineMarks = new Set([
  'EmphasisMark',
  'StrikethroughMark',
  'CodeMark',
])
const skippedParents = new Set(['FencedCode', 'CodeBlock'])

function isInsideSkippedParent(node: SyntaxNodeRef) {
  let parent = node.node.parent

  while (parent) {
    if (skippedParents.has(parent.name)) return true
    parent = parent.parent
  }

  return false
}

function buildDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = []
  const { state } = view
  const selectedLines = new Set<number>()
  const blockquoteLines = new Set<number>()

  for (const range of state.selection.ranges) {
    const firstLine = state.doc.lineAt(range.from).number
    const lastLine = state.doc.lineAt(range.to).number

    for (let line = firstLine; line <= lastLine; line += 1) {
      selectedLines.add(line)
    }
  }

  const isDragging = state.field(mouseSelectingField, false)

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === 'Blockquote') {
        const firstLine = state.doc.lineAt(node.from).number
        const lastLine = state.doc.lineAt(node.to).number

        for (let line = firstLine; line <= lastLine; line += 1) {
          blockquoteLines.add(line)
        }
        return
      }

      if (!blockMarks.has(node.name) && !inlineMarks.has(node.name)) return
      if (isInsideSkippedParent(node)) return

      if (node.name === 'CodeMark') {
        const parent = node.node.parent
        if (parent?.name === 'InlineCode') {
          const text = state.doc.sliceString(parent.from, parent.to)
          if (text.startsWith('`$') && text.endsWith('$`')) return
        }
      }

      if (blockMarks.has(node.name)) {
        const line = state.doc.lineAt(node.from).number
        const visible = selectedLines.has(line) && !isDragging
        const className = visible
          ? 'cm-formatting-block cm-formatting-block-visible'
          : 'cm-formatting-block'

        decorations.push(
          Decoration.mark({ class: className }).range(node.from, node.to),
        )
        return
      }

      const parent = node.node.parent
      const groupFrom = parent?.from ?? node.from
      const groupTo = parent?.to ?? node.to
      const visible = shouldShowSource(state, groupFrom, groupTo) && !isDragging
      const className = visible
        ? 'cm-formatting-inline cm-formatting-inline-visible'
        : 'cm-formatting-inline'

      decorations.push(
        Decoration.mark({ class: className }).range(node.from, node.to),
      )
    },
  })

  for (const lineNumber of blockquoteLines) {
    decorations.push(
      Decoration.line({ class: 'cm-blockquote-line' }).range(
        state.doc.line(lineNumber).from,
      ),
    )
  }

  return Decoration.set(
    decorations.sort((left, right) => left.from - right.from || left.to - right.to),
    true,
  )
}

export const codeMirrorLivePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: Parameters<typeof checkUpdateAction>[0]) {
      if (checkUpdateAction(update) === 'rebuild') {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
  },
)
