import '@blocknote/core/fonts/inter.css'
import '@blocknote/mantine/style.css'
import { BlockNoteView } from '@blocknote/mantine'
import { useCreateBlockNote } from '@blocknote/react'
import { useEffect, useRef } from 'react'
import type { EditorAdapterProps } from './types'

export default function BlockNoteEditor({
  initialValue,
  onChange,
}: EditorAdapterProps) {
  const editor = useCreateBlockNote()
  const isLoadingRef = useRef(true)

  useEffect(() => {
    isLoadingRef.current = true
    const blocks = editor.tryParseMarkdownToBlocks(initialValue)
    editor.replaceBlocks(editor.document, blocks)
    isLoadingRef.current = false
    onChange(editor.blocksToMarkdownLossy())
  }, [editor, initialValue, onChange])

  return (
    <div className="adapter-host rich-editor blocknote-host">
      <BlockNoteView
        editor={editor}
        theme="light"
        onChange={() => {
          if (!isLoadingRef.current) {
            onChange(editor.blocksToMarkdownLossy())
          }
        }}
      />
    </div>
  )
}
