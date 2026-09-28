import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import './App.css'
import { EditorBoundary } from './EditorBoundary'
import type { EditorDefinition } from './editors/types'
import { fixtures } from './fixtures'

const editors: EditorDefinition[] = [
  {
    id: 'codemirror',
    name: 'CodeMirror 6',
    foundation: 'CodeMirror text document',
    model: 'Exact Markdown source',
    note: 'Obsidian-style live preview keeps syntax available at the cursor.',
    component: lazy(() => import('./editors/CodeMirrorEditor')),
  },
  {
    id: 'tiptap',
    name: 'Tiptap',
    foundation: 'ProseMirror document',
    model: 'Markdown import and export',
    note: 'Polished rich text with a mature extension ecosystem.',
    component: lazy(() => import('./editors/TiptapEditor')),
  },
  {
    id: 'milkdown',
    name: 'Milkdown',
    foundation: 'ProseMirror + remark',
    model: 'Markdown-oriented WYSIWYG',
    note: 'A Markdown-first editor with its own opinionated presentation layer.',
    component: lazy(() => import('./editors/MilkdownEditor')),
  },
  {
    id: 'lexical',
    name: 'Lexical',
    foundation: 'Lexical editor state',
    model: 'Markdown transformers',
    note: 'Meta’s low-level React editor demonstrates the DIY framework route.',
    component: lazy(() => import('./editors/LexicalEditor')),
  },
  {
    id: 'blocknote',
    name: 'BlockNote',
    foundation: 'Typed block array',
    model: 'Lossy Markdown conversion',
    note: 'A batteries-included, Notion-style block experience.',
    component: lazy(() => import('./editors/BlockNoteEditor')),
  },
  {
    id: 'mdxeditor',
    name: 'MDXEditor',
    foundation: 'Lexical + MDAST',
    model: 'Markdown and MDX',
    note: 'The MDX-aware candidate supports JSX embedded in documents.',
    component: lazy(() => import('./editors/MdxEditor')),
  },
]

const countLines = (value: string) => value.split('\n').length
const countBytes = (value: string) => new TextEncoder().encode(value).length

function App() {
  const [editorId, setEditorId] = useState(editors[0].id)
  const [fixtureId, setFixtureId] = useState(fixtures[0]?.id ?? '')
  const [serialized, setSerialized] = useState(fixtures[0]?.source ?? '')
  const [runId, setRunId] = useState(0)
  const [traceMode, setTraceMode] = useState<'original' | 'serialized'>(
    'serialized',
  )
  const [copied, setCopied] = useState(false)

  const activeEditor = useMemo(
    () => editors.find((editor) => editor.id === editorId) ?? editors[0],
    [editorId],
  )
  const activeFixture = useMemo(
    () => fixtures.find((fixture) => fixture.id === fixtureId) ?? fixtures[0],
    [fixtureId],
  )

  const resetRun = useCallback(
    (nextEditorId = editorId, nextFixtureId = fixtureId) => {
      const nextFixture =
        fixtures.find((fixture) => fixture.id === nextFixtureId) ?? fixtures[0]
      setEditorId(nextEditorId)
      setFixtureId(nextFixtureId)
      setSerialized(nextFixture.source)
      setRunId((value) => value + 1)
      setCopied(false)
    },
    [editorId, fixtureId],
  )

  const handleOutput = useCallback((markdown: string) => {
    setSerialized(markdown)
    setCopied(false)
  }, [])

  const exactMatch = activeFixture.source === serialized
  const byteDelta = countBytes(serialized) - countBytes(activeFixture.source)
  const ActiveEditor = activeEditor.component
  const trace = traceMode === 'original' ? activeFixture.source : serialized

  const copyTrace = async () => {
    await navigator.clipboard.writeText(trace)
    setCopied(true)
  }

  return (
    <main className="playground-shell">
      <header className="masthead">
        <div>
          <p className="purpose">A live Markdown round-trip study</p>
          <h1>Editor proving ground</h1>
        </div>
        <div className="masthead-note">
          <span>{editors.length} adapters</span>
          <span>{fixtures.length} fixtures</span>
          <span>One source trace</span>
        </div>
      </header>

      <nav className="editor-tabs" aria-label="Editor candidates">
        {editors.map((editor) => (
          <button
            type="button"
            key={editor.id}
            aria-current={editor.id === activeEditor.id ? 'page' : undefined}
            onClick={() => resetRun(editor.id, activeFixture.id)}
          >
            {editor.name}
          </button>
        ))}
      </nav>

      <section className="workbench">
        <aside className="fixture-rail" aria-label="Sample documents">
          <div className="rail-heading">
            <h2>Fixtures</h2>
            <span>tracked files</span>
          </div>
          <div className="fixture-list">
            {fixtures.map((fixture) => (
              <button
                type="button"
                className={fixture.id === activeFixture.id ? 'is-selected' : ''}
                key={fixture.id}
                onClick={() => resetRun(activeEditor.id, fixture.id)}
              >
                <span>{fixture.label}</span>
                <small>{fixture.path.replace('src/content/', '')}</small>
              </button>
            ))}
          </div>

          <dl className="editor-facts">
            <div>
              <dt>Foundation</dt>
              <dd>{activeEditor.foundation}</dd>
            </div>
            <div>
              <dt>Content model</dt>
              <dd>{activeEditor.model}</dd>
            </div>
          </dl>
          <p className="editor-note">{activeEditor.note}</p>
        </aside>

        <section className="editor-stage" aria-labelledby="stage-title">
          <div className="pane-heading stage-heading">
            <div>
              <span>{activeFixture.kind}</span>
              <h2 id="stage-title">{activeFixture.label}</h2>
            </div>
            <button
              type="button"
              className="quiet-button"
              onClick={() => resetRun()}
            >
              Reset fixture
            </button>
          </div>
          <div
            className="editor-viewport"
            role="group"
            tabIndex={0}
            aria-label={`${activeEditor.name} editing surface`}
          >
            <EditorBoundary
              key={`boundary-${activeEditor.id}-${activeFixture.id}-${runId}`}
              editorName={activeEditor.name}
            >
              <Suspense
                fallback={<p className="adapter-loading">Loading adapter…</p>}
              >
                <ActiveEditor
                  key={`${activeEditor.id}-${activeFixture.id}-${runId}`}
                  initialValue={activeFixture.source}
                  onChange={handleOutput}
                />
              </Suspense>
            </EditorBoundary>
          </div>
        </section>

        <aside className="trace-pane" aria-labelledby="trace-title">
          <div className="pane-heading trace-heading">
            <div>
              <span>Source trace</span>
              <h2 id="trace-title">
                {exactMatch ? 'Exact match' : 'Changed on export'}
              </h2>
            </div>
            <span className={`match-light ${exactMatch ? 'is-exact' : ''}`} />
          </div>

          <div
            className="trace-metrics"
            role="group"
            aria-label="Round-trip metrics"
          >
            <div>
              <strong>{countLines(serialized)}</strong>
              <span>lines</span>
            </div>
            <div>
              <strong>{byteDelta > 0 ? `+${byteDelta}` : byteDelta}</strong>
              <span>byte delta</span>
            </div>
            <div>
              <strong>{exactMatch ? 'yes' : 'no'}</strong>
              <span>byte exact</span>
            </div>
          </div>

          <div className="trace-switch" role="group" aria-label="Trace view">
            <button
              type="button"
              className={traceMode === 'original' ? 'is-active' : ''}
              onClick={() => {
                setTraceMode('original')
                setCopied(false)
              }}
            >
              Original
            </button>
            <button
              type="button"
              className={traceMode === 'serialized' ? 'is-active' : ''}
              onClick={() => {
                setTraceMode('serialized')
                setCopied(false)
              }}
            >
              Serialized
            </button>
            <button type="button" className="copy-button" onClick={copyTrace}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <pre className="trace-output" tabIndex={0}>
            <code>{trace}</code>
          </pre>
        </aside>
      </section>
    </main>
  )
}

export default App
