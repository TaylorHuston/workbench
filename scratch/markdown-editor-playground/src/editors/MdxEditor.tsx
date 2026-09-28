import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  GenericJsxEditor,
  InsertCodeBlock,
  InsertTable,
  ListsToggle,
  MDXEditor,
  UndoRedo,
  codeBlockPlugin,
  codeMirrorPlugin,
  frontmatterPlugin,
  headingsPlugin,
  jsxPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import { useState } from 'react'
import type { EditorAdapterProps } from './types'

const plugins = [
  headingsPlugin(),
  listsPlugin(),
  quotePlugin(),
  thematicBreakPlugin(),
  linkPlugin(),
  linkDialogPlugin(),
  tablePlugin(),
  frontmatterPlugin(),
  codeBlockPlugin({ defaultCodeBlockLanguage: 'text' }),
  codeMirrorPlugin({
    codeBlockLanguages: {
      text: 'Plain text',
      ts: 'TypeScript',
      tsx: 'TypeScript (React)',
      jsx: 'JavaScript (React)',
    },
  }),
  jsxPlugin({
    jsxComponentDescriptors: [
      {
        name: 'Accent',
        kind: 'text',
        props: [],
        hasChildren: true,
        Editor: GenericJsxEditor,
      },
      {
        name: 'aside',
        kind: 'flow',
        props: [{ name: 'data-kind', type: 'string' }],
        hasChildren: true,
        Editor: GenericJsxEditor,
      },
    ],
  }),
  markdownShortcutPlugin(),
  toolbarPlugin({
    toolbarContents: () => (
      <>
        <UndoRedo />
        <BlockTypeSelect />
        <BoldItalicUnderlineToggles />
        <ListsToggle />
        <CreateLink />
        <InsertTable />
        <InsertCodeBlock />
      </>
    ),
  }),
]

export default function MdxEditor({
  initialValue,
  onChange,
}: EditorAdapterProps) {
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="adapter-host rich-editor mdxeditor-host">
      {error ? <div className="adapter-error">Parser note: {error}</div> : null}
      <MDXEditor
        markdown={initialValue}
        plugins={plugins}
        onChange={(markdown) => {
          setError(null)
          onChange(markdown)
        }}
        onError={({ error: message }) => setError(message)}
        contentEditableClassName="mdxeditor-content"
      />
    </div>
  )
}
