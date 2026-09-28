import { Markdown } from '@tiptap/markdown'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef } from 'react'
import type { EditorAdapterProps } from './types'

export default function TiptapEditor({
  initialValue,
  onChange,
}: EditorAdapterProps) {
  const onChangeRef = useRef(onChange)
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: initialValue,
    contentType: 'markdown',
    onUpdate: ({ editor: activeEditor }) => {
      onChangeRef.current(activeEditor.getMarkdown())
    },
  })

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (editor) onChangeRef.current(editor.getMarkdown())
  }, [editor])

  if (!editor) {
    return <p className="adapter-loading">Starting Tiptap…</p>
  }

  return (
    <div className="adapter-host rich-editor tiptap-host">
      <div className="native-toolbar" aria-label="Tiptap formatting">
        <button
          type="button"
          className={editor.isActive('bold') ? 'is-active' : ''}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          Bold
        </button>
        <button
          type="button"
          className={editor.isActive('italic') ? 'is-active' : ''}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          Italic
        </button>
        <button
          type="button"
          className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          Heading
        </button>
        <button
          type="button"
          className={editor.isActive('bulletList') ? 'is-active' : ''}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          List
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
