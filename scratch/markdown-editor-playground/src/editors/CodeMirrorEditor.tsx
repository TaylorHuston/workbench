import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { GFM } from '@lezer/markdown'
import {
  codeBlockField,
  collapseOnSelectionFacet,
  editorTheme,
  linkPlugin,
  markdownStylePlugin,
  mouseSelectingField,
  setMouseSelecting,
  tableField,
} from 'codemirror-live-markdown'
import { useEffect, useRef } from 'react'
import { codeMirrorListPreview } from './codeMirrorListPreview'
import { codeMirrorLivePreviewPlugin } from './codeMirrorLivePreview'
import type { EditorAdapterProps } from './types'

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading, color: '#17272a', fontWeight: '700' },
  { tag: [tags.keyword, tags.atom, tags.bool], color: '#7b2c24' },
  { tag: [tags.string, tags.url, tags.link], color: '#1c5d59' },
  { tag: [tags.comment, tags.meta], color: '#53666a' },
  { tag: [tags.number, tags.monospace], color: '#70451c' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
])

export default function CodeMirrorEditor({
  initialValue,
  onChange,
}: EditorAdapterProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!hostRef.current) return

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: initialValue,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          markdown({ extensions: [GFM] }),
          syntaxHighlighting(markdownHighlightStyle),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            'aria-label': 'Markdown source editor',
          }),
          collapseOnSelectionFacet.of(true),
          mouseSelectingField,
          codeMirrorLivePreviewPlugin,
          markdownStylePlugin,
          codeMirrorListPreview,
          codeBlockField({
            lineNumbers: false,
            copyButton: true,
            defaultLanguage: 'text',
          }),
          tableField,
          linkPlugin(),
          editorTheme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString())
            }
          }),
          EditorView.theme({
            '&': {
              height: '100%',
              background: 'transparent',
              color: 'var(--ink)',
              fontSize: '16px',
            },
            '.cm-scroller': {
              fontFamily: 'var(--editor-font)',
              lineHeight: '1.7',
              padding: '18px 8px 48px 0',
            },
            '.cm-content': {
              flex: '1 1 0',
              minWidth: '0',
              maxWidth: '760px',
              padding: '0 28px',
            },
            '.cm-line.cm-blockquote-line': {
              paddingLeft: '18px',
              borderLeft: '3px solid var(--accent)',
              backgroundColor: 'rgba(35, 104, 103, 0.055)',
              color: 'var(--muted)',
              fontStyle: 'italic',
            },
            '.cm-line.cm-blockquote-line.cm-activeLine': {
              backgroundColor: 'rgba(35, 104, 103, 0.09)',
            },
            '.cm-codeblock-widget': {
              width: '100%',
              maxWidth: '100%',
              border: '1px solid var(--rule)',
              borderLeft: '3px solid var(--accent)',
              borderRadius: '3px',
              backgroundColor: 'var(--paper-deep)',
            },
            '.cm-codeblock-widget pre': {
              overflow: 'hidden !important',
              color: 'var(--ink)',
              fontFamily: 'var(--mono-font)',
            },
            '.cm-codeblock-widget .cm-codeblock-line': {
              minHeight: '24px',
              padding: '0 14px',
              fontSize: '13px',
              lineHeight: '1.85',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            },
            '.cm-codeblock-widget .cm-codeblock-fence': {
              color: 'var(--muted)',
              fontSize: '11px',
            },
            '.cm-codeblock-copy': {
              color: 'var(--ink)',
              border: '1px solid var(--rule)',
              backgroundColor: 'var(--paper)',
              fontFamily: 'var(--body-font)',
            },
            '.cm-codeblock-source': {
              backgroundColor: 'rgba(35, 104, 103, 0.055)',
            },
            '.cm-codeblock-widget .hljs-keyword, .cm-codeblock-widget .hljs-operator': {
              color: '#8f2f36',
            },
            '.cm-codeblock-widget .hljs-string': { color: '#174f44' },
            '.cm-codeblock-widget .hljs-number, .cm-codeblock-widget .hljs-built_in, .cm-codeblock-widget .hljs-literal, .cm-codeblock-widget .hljs-attr': {
              color: '#18578a',
            },
            '.cm-codeblock-widget .hljs-function, .cm-codeblock-widget .hljs-title': {
              color: '#5d3a91',
            },
            '.cm-codeblock-widget .hljs-comment': { color: 'var(--muted)' },
            '.cm-codeblock-widget .hljs-class, .cm-codeblock-widget .hljs-selector-tag': {
              color: '#236838',
            },
            '.cm-codeblock-widget .hljs-variable': { color: '#8a4718' },
            '.cm-codeblock-widget .hljs-punctuation, .cm-codeblock-widget .hljs-params': {
              color: 'var(--ink)',
            },
            '.cm-content .cm-link, .cm-content .cm-link-widget, .cm-content .cm-wikilink, .cm-content .cm-wikilink-widget': {
              color: '#1c5d59',
            },
            '.cm-formatting-inline': { color: 'var(--muted)' },
            '.cm-gutters': {
              background: 'transparent',
              borderRight: '1px solid var(--rule)',
              color: 'var(--muted)',
            },
            '.cm-activeLine, .cm-activeLineGutter': {
              backgroundColor: 'rgba(35, 104, 103, 0.06)',
            },
            '&.cm-focused': { outline: 'none' },
            '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent)' },
          }),
        ],
      }),
    })

    let disposed = false
    const beginMouseSelection = () => {
      view.dispatch({ effects: setMouseSelecting.of(true) })
    }
    const endMouseSelection = () => {
      requestAnimationFrame(() => {
        if (!disposed) {
          view.dispatch({ effects: setMouseSelecting.of(false) })
        }
      })
    }

    view.contentDOM.addEventListener('mousedown', beginMouseSelection)
    document.addEventListener('mouseup', endMouseSelection)

    return () => {
      disposed = true
      view.contentDOM.removeEventListener('mousedown', beginMouseSelection)
      document.removeEventListener('mouseup', endMouseSelection)
      view.destroy()
    }
  }, [initialValue])

  return <div className="adapter-host codemirror-host" ref={hostRef} />
}
