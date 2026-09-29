import { CodeNode } from '@lexical/code'
import { LinkNode } from '@lexical/link'
import { ListItemNode, ListNode } from '@lexical/list'
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from '@lexical/markdown'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import type { EditorState } from 'lexical'
import { useEffect, useRef } from 'react'
import {
  renderWikilinksForEditor,
  restoreWikilinksFromEditor,
  useWikilinkNavigation,
} from './markdownWikilinks'
import type { EditorAdapterProps } from './types'

function InitialMarkdownReporter({ onChange }: Pick<EditorAdapterProps, 'onChange'>) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    editor.getEditorState().read(() => {
      onChange(
        restoreWikilinksFromEditor($convertToMarkdownString(TRANSFORMERS)),
      )
    })
  }, [editor, onChange])

  return null
}

export default function LexicalEditor({
  initialValue,
  onChange,
}: EditorAdapterProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  useWikilinkNavigation(hostRef)

  const handleChange = (editorState: EditorState) => {
    editorState.read(() => {
      onChange(
        restoreWikilinksFromEditor($convertToMarkdownString(TRANSFORMERS)),
      )
    })
  }

  return (
    <div
      className="adapter-host rich-editor lexical-host"
      ref={hostRef}
    >
      <LexicalComposer
        initialConfig={{
          namespace: 'markdown-editor-playground',
          nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, LinkNode],
          onError: (error) => {
            throw error
          },
          editorState: () => {
            $convertFromMarkdownString(
              renderWikilinksForEditor(initialValue),
              TRANSFORMERS,
            )
          },
          theme: {
            heading: {
              h1: 'editor-heading editor-heading-1',
              h2: 'editor-heading editor-heading-2',
              h3: 'editor-heading editor-heading-3',
            },
            quote: 'editor-quote',
            code: 'editor-code-block',
            text: {
              bold: 'editor-bold',
              italic: 'editor-italic',
              code: 'editor-inline-code',
              strikethrough: 'editor-strike',
            },
          },
        }}
      >
        <div className="lexical-editor-frame">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="lexical-content"
                aria-label="Lexical Markdown editor"
              />
            }
            placeholder={
              <p className="editor-placeholder">Write Markdown shortcuts here…</p>
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <InitialMarkdownReporter onChange={onChange} />
        <OnChangePlugin onChange={handleChange} ignoreSelectionChange />
      </LexicalComposer>
    </div>
  )
}
