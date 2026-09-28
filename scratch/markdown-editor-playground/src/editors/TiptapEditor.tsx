import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import { Markdown } from '@tiptap/markdown'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef } from 'react'
import { TiptapCodeBlock } from './tiptapCodeBlock'
import { TiptapFrontmatter } from './tiptapFrontmatter'
import type { EditorAdapterProps } from './types'

export default function TiptapEditor({
  initialValue,
  onChange,
}: EditorAdapterProps) {
  const onChangeRef = useRef(onChange)
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: true } }),
      TiptapCodeBlock,
      TiptapFrontmatter,
      Markdown,
    ],
    content: initialValue,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        'aria-label': 'Markdown rich text editor',
        'aria-multiline': 'true',
        role: 'textbox',
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      onChangeRef.current(activeEditor.getMarkdown())
    },
  })

  const blockStyle = useEditorState({
    editor,
    selector: ({ editor: activeEditor }) => {
      if (!activeEditor) return 'paragraph'
      if (activeEditor.isActive('heading', { level: 1 })) return 'heading-1'
      if (activeEditor.isActive('heading', { level: 2 })) return 'heading-2'
      if (activeEditor.isActive('heading', { level: 3 })) return 'heading-3'
      return 'paragraph'
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
      <div
        className="native-toolbar"
        role="toolbar"
        aria-label="Tiptap formatting"
      >
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
        <select
          aria-label="Block style"
          value={blockStyle ?? 'paragraph'}
          onChange={(event) => {
            const nextStyle = event.target.value
            const chain = editor.chain().focus()

            if (nextStyle === 'paragraph') {
              chain.setParagraph().run()
              return
            }

            const level = Number(nextStyle.split('-')[1]) as 1 | 2 | 3
            chain.setHeading({ level }).run()
          }}
        >
          <option value="paragraph">Paragraph</option>
          <option value="heading-1">Heading 1</option>
          <option value="heading-2">Heading 2</option>
          <option value="heading-3">Heading 3</option>
        </select>
        <button
          type="button"
          className={editor.isActive('bulletList') ? 'is-active' : ''}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          List
        </button>
        <button
          type="button"
          className={editor.isActive('table') ? 'is-active' : ''}
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
        >
          Table
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
