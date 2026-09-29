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
import type { JsxEditorProps } from '@mdxeditor/editor'
import '@mdxeditor/editor/style.css'
import { createContext, useContext, useRef, useState } from 'react'
import { FrontmatterPanel } from './FrontmatterPanel'
import {
  joinMarkdownFrontmatter,
  splitMarkdownFrontmatter,
} from './markdownFrontmatter'
import {
  decodeHtmlComment,
  renderHtmlCommentsForMdxEditor,
  restoreHtmlCommentsFromMdxEditor,
} from './mdxHtmlComments'
import {
  renderWikilinksForEditor,
  restoreWikilinksFromEditor,
  useWikilinkNavigation,
} from './markdownWikilinks'
import type { EditorAdapterProps } from './types'

interface MdxFrontmatterContextValue {
  value: string | null
  onChange: (yaml: string) => void
}

const MdxFrontmatterContext = createContext<MdxFrontmatterContextValue | null>(
  null,
)

function MdxToolbar() {
  const frontmatter = useContext(MdxFrontmatterContext)

  return (
    <>
      <div className="mdx-toolbar-controls">
        <UndoRedo />
        <BlockTypeSelect />
        <BoldItalicUnderlineToggles />
        <ListsToggle />
        <CreateLink />
        <InsertTable />
        <InsertCodeBlock />
      </div>
      {frontmatter && frontmatter.value !== null ? (
        <FrontmatterPanel
          id="mdxeditor-frontmatter"
          value={frontmatter.value}
          onChange={frontmatter.onChange}
        />
      ) : null}
    </>
  )
}

function MarkdownHtmlCommentEditor({ mdastNode }: JsxEditorProps) {
  const value = mdastNode.attributes.find(
    (attribute) =>
      attribute.type === 'mdxJsxAttribute' && attribute.name === 'value',
  )?.value
  const comment = typeof value === 'string' ? decodeHtmlComment(value) : null
  const label = comment?.trim() || 'Empty HTML comment'

  return (
    <span
      className="mdx-html-comment"
      title={label}
      aria-label={`HTML comment: ${label}`}
    >
      HTML comment
    </span>
  )
}

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
        name: 'MarkdownHtmlComment',
        kind: 'flow',
        props: [{ name: 'value', type: 'string' }],
        hasChildren: false,
        Editor: MarkdownHtmlCommentEditor,
      },
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
    toolbarContents: () => <MdxToolbar />,
  }),
]

export default function MdxEditor({
  initialValue,
  onChange,
}: EditorAdapterProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  useWikilinkNavigation(hostRef)

  const initialDocument = splitMarkdownFrontmatter(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [frontmatter, setFrontmatter] = useState(initialDocument.yaml)
  const bodyMarkdownRef = useRef(initialDocument.body)
  const handleFrontmatterChange = (yaml: string) => {
    setFrontmatter(yaml)
    onChange(joinMarkdownFrontmatter(yaml, bodyMarkdownRef.current))
  }

  return (
    <div
      className="adapter-host rich-editor mdxeditor-host"
      ref={hostRef}
    >
      {error ? <div className="adapter-error">Parser note: {error}</div> : null}
      <MdxFrontmatterContext.Provider
        value={{ value: frontmatter, onChange: handleFrontmatterChange }}
      >
        <MDXEditor
          markdown={renderHtmlCommentsForMdxEditor(
            renderWikilinksForEditor(initialDocument.body),
          )}
          plugins={plugins}
          onChange={(markdown) => {
            setError(null)
            const restoredMarkdown = restoreHtmlCommentsFromMdxEditor(
              restoreWikilinksFromEditor(markdown),
            )
            bodyMarkdownRef.current = restoredMarkdown
            onChange(joinMarkdownFrontmatter(frontmatter, restoredMarkdown))
          }}
          onError={({ error: message }) => setError(message)}
          contentEditableClassName="mdxeditor-content"
        />
      </MdxFrontmatterContext.Provider>
    </div>
  )
}
