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
import { useRef, useState } from 'react'
import { FrontmatterPanel } from './FrontmatterPanel'
import {
  joinMarkdownFrontmatter,
  splitMarkdownFrontmatter,
} from './markdownFrontmatter'
import type { EditorAdapterProps } from './types'

const plugins = [
  headingsPlugin(),
  listsPlugin(),
  quotePlugin(),
  thematicBreakPlugin(),
  linkPlugin(),
  linkDialogPlugin(),
  tablePlugin(),
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
  const initialDocument = splitMarkdownFrontmatter(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [frontmatter, setFrontmatter] = useState(initialDocument.yaml)
  const bodyMarkdownRef = useRef(initialDocument.body)

  return (
    <div className="adapter-host rich-editor mdxeditor-host">
      {error ? <div className="adapter-error">Parser note: {error}</div> : null}
      {frontmatter !== null ? (
        <FrontmatterPanel
          id="mdxeditor-frontmatter"
          value={frontmatter}
          onChange={(yaml) => {
            setFrontmatter(yaml)
            onChange(joinMarkdownFrontmatter(yaml, bodyMarkdownRef.current))
          }}
        />
      ) : null}
      <MDXEditor
        markdown={initialDocument.body}
        plugins={plugins}
        onChange={(markdown) => {
          setError(null)
          bodyMarkdownRef.current = markdown
          onChange(joinMarkdownFrontmatter(frontmatter, markdown))
        }}
        onError={({ error: message }) => setError(message)}
        contentEditableClassName="mdxeditor-content"
      />
    </div>
  )
}
