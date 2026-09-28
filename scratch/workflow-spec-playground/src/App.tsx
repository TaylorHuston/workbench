import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'
import { DiagramEditor } from '@openworkflowspec/diagram-editor'
import { analyze } from './analyze'
import { examples } from './examples'
import { getWorkflowProperties } from './properties'

const first = examples[0]

export function App() {
  const [source, setSource] = useState(first.yaml)
  const [settledSource, setSettledSource] = useState(first.yaml)
  const [lastDrawable, setLastDrawable] = useState(first.yaml)
  const [selectedId, setSelectedId] = useState<string | null>(first.id)
  const [activeView, setActiveView] = useState<'source' | 'preview'>('source')
  const [notice, setNotice] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const sourceTab = useRef<HTMLButtonElement>(null)
  const previewTab = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setSettledSource(source), 300)
    return () => window.clearTimeout(timer)
  }, [source])

  const analysis = useMemo(() => analyze(settledSource), [settledSource])
  const previewSource = analysis.graph ? settledSource : lastDrawable
  const properties = useMemo(() => getWorkflowProperties(previewSource), [previewSource])
  useEffect(() => {
    if (analysis.graph) setLastDrawable(settledSource)
  }, [analysis.graph, settledSource])

  const selectedExample = examples.find((example) => example.id === selectedId)
  const changed = selectedExample ? source !== selectedExample.yaml : true
  const taskNodes = analysis.graph?.nodes.filter((node) => node.taskReference) ?? []
  const edgeCount = analysis.graph?.edges.length ?? 0
  const pending = source !== settledSource
  const status = pending ? 'Updating preview…' : analysis.diagnostics.length
    ? `${analysis.diagnostics.length} ${analysis.diagnostics.length === 1 ? 'issue' : 'issues'} to inspect`
    : 'Valid specification'

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    let nextView: 'source' | 'preview'
    if (event.key === 'Home') nextView = 'source'
    else if (event.key === 'End') nextView = 'preview'
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') nextView = activeView === 'source' ? 'preview' : 'source'
    else return
    event.preventDefault()
    setActiveView(nextView)
    const tab = nextView === 'source' ? sourceTab : previewTab
    tab.current?.focus()
  }

  function chooseExample(id: string) {
    const example = examples.find((item) => item.id === id)
    if (!example || (changed && !window.confirm('Replace your current edits with this example?'))) return
    setSelectedId(id)
    setSource(example.yaml)
    setSettledSource(example.yaml)
    setNotice(`Loaded ${example.title}.`)
  }

  function reset() {
    if (!selectedExample || !changed || !window.confirm('Discard edits to this example?')) return
    setSource(selectedExample.yaml)
    setSettledSource(selectedExample.yaml)
    setNotice('Example reset.')
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 256_000) {
      setNotice('File too large. Choose a workflow smaller than 256 KB.')
      return
    }
    if (changed && !window.confirm('Replace your current edits with the imported file?')) return
    setSelectedId(null)
    const text = await file.text()
    setSource(text)
    setSettledSource(text)
    setNotice(`Loaded ${file.name} locally. No file was uploaded.`)
  }

  function download() {
    const isJson = source.trimStart().startsWith('{')
    const url = URL.createObjectURL(new Blob([source], { type: isJson ? 'application/json' : 'text/yaml' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `workflow-draft.${isJson ? 'json' : 'yaml'}`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('Downloaded current source.')
  }

  return (
    <div className="shell">
      <header className="site-header">
        <div className="identity">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <div><span className="brand-name">Workflow Fieldbook</span><span className="brand-subtitle">A specification playground</span></div>
        </div>
        <span className="header-note">A local experiment · Nothing runs</span>
      </header>

      <main>
        <section className="intro" aria-labelledby="page-title">
          <div>
            <p className="context">Design with the source. Inspect the shape.</p>
            <h1 id="page-title">What does a workflow look like on paper?</h1>
            <p className="intro-copy">Pick a starting point, rewrite the YAML, and see what the specification makes visible. These are descriptions of processes, not executable automations.</p>
          </div>
          <a className="spec-link" href="https://open-workflow-specification.org/" target="_blank" rel="noreferrer">About the specification <span aria-hidden="true">↗</span></a>
        </section>

        <div className="workspace">
          <aside className="samples" aria-labelledby="samples-heading">
            <div className="section-heading"><h2 id="samples-heading">Starting points</h2><span>3 examples</span></div>
            <div className="sample-list">
              {examples.map((example) => (
                <button className={`sample${selectedId === example.id ? ' selected' : ''}`} type="button" key={example.id} onClick={() => chooseExample(example.id)} aria-pressed={selectedId === example.id}>
                  <span className="sample-title">{example.title}</span>
                  <span className="sample-description">{example.description}</span>
                </button>
              ))}
            </div>
            <div className="samples-note"><strong>How to read these</strong><p>Decision fields are declared in <code>input.schema</code> and read from <code>$context</code>. The <code>set</code> tasks stand in for human steps; nothing here runs.</p></div>
          </aside>

          <div className="editor-workspace">
            <div className="workspace-tabs" role="tablist" aria-label="Workflow views">
              <button ref={sourceTab} id="source-tab" type="button" role="tab" aria-controls="source-panel" aria-selected={activeView === 'source'} tabIndex={activeView === 'source' ? 0 : -1} onClick={() => setActiveView('source')} onKeyDown={handleTabKeyDown}>Source</button>
              <button ref={previewTab} id="preview-tab" type="button" role="tab" aria-controls="preview-panel" aria-selected={activeView === 'preview'} tabIndex={activeView === 'preview' ? 0 : -1} onClick={() => setActiveView('preview')} onKeyDown={handleTabKeyDown}>Preview</button>
            </div>

            <div id="source-panel" className="view-panel" role="tabpanel" aria-labelledby="source-tab" tabIndex={0} hidden={activeView !== 'source'}>
              <section className="source-pane" aria-labelledby="source-heading">
                <div className="pane-header">
                  <div><span className="pane-index">Source</span><h2 id="source-heading">Workflow definition</h2></div>
                  <span className="format-tag">YAML / JSON</span>
                </div>
                <div className="source-actions">
                  <button type="button" onClick={() => fileInput.current?.click()}>Import file</button>
                  <input ref={fileInput} type="file" accept=".yaml,.yml,.json,application/json,text/yaml" onChange={importFile} aria-label="Import a YAML or JSON workflow" hidden />
                  <button type="button" onClick={download}>Download</button>
                  {selectedExample && <button type="button" onClick={reset} disabled={!changed}>Reset example</button>}
                </div>
                <label className="visually-hidden" htmlFor="workflow-source">Workflow YAML or JSON</label>
                <textarea id="workflow-source" className="source-editor" spellCheck={false} value={source} onChange={(event) => { setSource(event.target.value); setNotice('') }} aria-describedby="source-help" />
                <p className="pane-help" id="source-help">Switch to Preview to see the diagram. Syntax errors keep the last drawable workflow visible.</p>
              </section>
            </div>

            <div id="preview-panel" className="view-panel" role="tabpanel" aria-labelledby="preview-tab" tabIndex={0} hidden={activeView !== 'preview'}>
              {activeView === 'preview' && <section className="diagram-pane" aria-labelledby="diagram-heading">
                <div className="pane-header diagram-header">
                  <div><span className="pane-index">Preview</span><h2 id="diagram-heading">The shape of the work</h2></div>
                  <span className="preview-label">Read-only diagram</span>
                </div>
                <div className="diagram-surface">
                  <DiagramEditor content={previewSource} isReadOnly={true} locale="en" colorMode="light" />
                  <aside className="properties-card" aria-labelledby="properties-heading">
                    <h3 id="properties-heading">Properties</h3>
                    {properties.fields.length ? (
                      <ul className="properties-list">
                        {properties.fields.map((property) => (
                          <li key={property.name}>
                            <div className="property-line"><strong>{property.name}</strong><span>{property.type}</span></div>
                            <div className="property-detail">
                              {property.required ? 'Required' : 'Optional'}
                              {property.options.length > 0 && ` · ${property.options.join(' / ')}`}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="properties-empty">{properties.kind === 'external'
                      ? 'Schema is external; fields are not shown here.'
                      : properties.kind === 'inline'
                        ? 'No fields declared in input.schema.'
                        : 'No workflow input schema declared.'}</p>}
                  </aside>
                </div>
                {!pending && !analysis.graph && <p className="preview-warning" role="status">Showing the last drawable workflow. Fix the source to refresh the diagram.</p>}
              </section>}
            </div>
          </div>
        </div>

        <section className="inspection" aria-labelledby="inspection-heading">
          <div className="inspection-top"><div><p className="context">Under the hood</p><h2 id="inspection-heading">Specification check</h2></div><span className={`status${!pending && analysis.diagnostics.length ? ' invalid' : ''}`} role="status">{status}</span></div>
          <div className="inspection-grid">
            <div className="inspection-block"><h3>Validation</h3>
              {analysis.diagnostics.length ? <ul className="diagnostics">{analysis.diagnostics.map((item, index) => <li key={`${item.path}-${index}`}><span>{item.path || 'Source'}</span>{item.message}</li>)}</ul> : <p className="quiet">{pending ? 'Checking your latest edits…' : 'The SDK reports no issues with this workflow.'}</p>}
            </div>
            <div className="inspection-block"><h3>Graph from the SDK</h3>
              {analysis.graph ? <><p className="graph-count">{taskNodes.length} task{taskNodes.length === 1 ? '' : 's'} <span>/</span> {edgeCount} connection{edgeCount === 1 ? '' : 's'}</p><p className="quiet">{taskNodes.map((node) => node.label ?? node.id).join('  →  ')}</p></> : <p className="quiet">The SDK could not construct a graph from this draft.</p>}
            </div>
          </div>
        </section>
        <p className="footnote">YAML / JSON <span>→</span> TypeScript SDK <span>→</span> validated graph <span>→</span> diagram editor. Nothing is executed or sent to a server.</p>
        <div className="visually-hidden" role="status" aria-live="polite">{notice}</div>
      </main>
    </div>
  )
}
