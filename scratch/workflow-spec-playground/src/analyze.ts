import { Classes, SchemaValidationError, buildFlatGraph, validate } from '@openworkflowspec/sdk'
import type { FlatGraph, Specification } from '@openworkflowspec/sdk'
import { load } from 'js-yaml'

export type Diagnostic = { path?: string; message: string }
export type Analysis = { graph: FlatGraph | null; diagnostics: Diagnostic[]; parsed: boolean }

export function analyze(source: string): Analysis {
  try {
    const raw: unknown = load(source)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { graph: null, parsed: false, diagnostics: [{ message: 'Start with a workflow mapping (document and do).' }] }
    }

    // Hydrate without validation so a structurally plausible draft can still be drawn.
    const workflow = new Classes.Workflow(raw as Partial<Specification.Workflow>)
    let diagnostics: Diagnostic[] = []
    try {
      validate('Workflow', workflow)
    } catch (error) {
      if (error instanceof SchemaValidationError && error.schemaErrors.length) {
        diagnostics = error.schemaErrors.map((issue) => ({
          path: issue.instancePath || '/',
          message: issue.message ?? 'Invalid value',
        }))
      } else {
        diagnostics = [{
          path: error instanceof Error && 'path' in error ? String(error.path) : undefined,
          message: error instanceof Error ? error.message : String(error),
        }]
      }
    }

    // The graph is separate from validation: if it cannot be built, keep the last preview.
    try {
      return { graph: buildFlatGraph(workflow, true), parsed: true, diagnostics }
    } catch (error) {
      return {
        graph: null,
        parsed: false,
        diagnostics: [...diagnostics, { message: `Cannot draw this draft: ${error instanceof Error ? error.message : String(error)}` }],
      }
    }
  } catch (error) {
    return { graph: null, parsed: false, diagnostics: [{ message: error instanceof Error ? error.message : String(error) }] }
  }
}
