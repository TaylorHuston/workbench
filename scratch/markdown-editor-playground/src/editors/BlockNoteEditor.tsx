import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { BlockNoteView } from '@blocknote/mantine'
import { useCreateBlockNote } from '@blocknote/react'
import { useEffect, useRef, useState } from 'react'
import { FrontmatterPanel } from './FrontmatterPanel'
import {
  joinMarkdownFrontmatter,
  splitMarkdownFrontmatter,
} from './markdownFrontmatter'
import type { EditorAdapterProps } from './types'

export default function BlockNoteEditor({
  initialValue,
  onChange,
}: EditorAdapterProps) {
  const editor = useCreateBlockNote()
  const initialDocument = splitMarkdownFrontmatter(initialValue)
  const [frontmatter, setFrontmatter] = useState(initialDocument.yaml)
  const bodyMarkdownRef = useRef(initialDocument.body)
  const isLoadingRef = useRef(true)

  useEffect(() => {
    const document = splitMarkdownFrontmatter(initialValue)
    isLoadingRef.current = true
    const blocks = editor.tryParseMarkdownToBlocks(document.body)
    editor.replaceBlocks(editor.document, blocks)
    bodyMarkdownRef.current = editor.blocksToMarkdownLossy()
    isLoadingRef.current = false
    onChange(joinMarkdownFrontmatter(document.yaml, bodyMarkdownRef.current))
  }, [editor, initialValue, onChange])

  return (
    <div className="adapter-host rich-editor blocknote-host">
      {frontmatter !== null ? (
        <FrontmatterPanel
          id="blocknote-frontmatter"
          value={frontmatter}
          onChange={(yaml) => {
            setFrontmatter(yaml)
            onChange(joinMarkdownFrontmatter(yaml, bodyMarkdownRef.current))
          }}
        />
      ) : null}
      <BlockNoteView
        editor={editor}
        theme="light"
        onChange={() => {
          if (!isLoadingRef.current) {
            bodyMarkdownRef.current = editor.blocksToMarkdownLossy()
            onChange(
              joinMarkdownFrontmatter(frontmatter, bodyMarkdownRef.current),
            )
          }
        }}
      />
    </div>
  )
}
