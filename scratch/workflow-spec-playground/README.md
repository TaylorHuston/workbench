# Workflow Fieldbook

> **Section:** Scratch
>
> **Status:** Experimental
>
> **Source:** [Open Workflow Specification](https://open-workflow-specification.org/), [TypeScript SDK](https://github.com/open-workflow-specification/sdk-typescript), [Diagram Editor](https://github.com/open-workflow-specification/editor/tree/main/packages/open-workflow-diagram-editor)

## Purpose

A local, source-first playground to see whether the Open Workflow Specification helps **design and visualize** personal processes. No workflow execution, backend, accounts, or external calls are involved.

## Context

The official SDK parses, validates and builds a graph from the YAML; the official React diagram component renders the same source. The examples are deliberately conceptual: their `set` steps stand in for human activities and do **not** perform them. The decision fields are declared under workflow `input.schema` (`priority: string` or `needsFollowUp: boolean`), then read from the initial workflow input via `$context.priority` or `$context.needsFollowUp`. A hypothetical caller would provide values such as `{ "priority": "now" }`; the schema declares them but does not supply them. This app does not accept input values, execute tasks, or evaluate decisions. This is a test of how naturally the specification represents human workflows, not an implementation of those workflows.

## Running it

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`). Run `npm test` and `npm run build` to check the experiment.

## Notes

- Starting points stay beside a tabbed Source/Preview work area on desktop (stacked on narrow screens). Edit YAML in Source, then open Preview; edits persist across tabs. Syntax errors leave the last parseable diagram and its Properties card visible and show a diagnostic. Schema-invalid but parseable drafts may still render, with errors reported separately.
- The pinned Properties card reads top-level inline `input.schema.document.properties` (name, type, required status, and enum choices) from the same source as the diagram. It does not pan with the graph, evaluate expressions, or fetch external schemas; workflows without an inline input schema show a clear empty state.
- Load a sample, import a local `.yaml`, `.yml` or `.json` file, reset the current sample, or download your edited source. Files stay in your browser unless you explicitly download them. The examples are public, generic prompts; do not paste private notes into a public repository.
- SDK `1.0.3-alpha6` is pinned to the editor `1.1.0` dependency, rather than the SDK's older npm `latest` tag. Both are experimental upstream APIs.
- Diagram editing is deliberately disabled: this spike tests the DSL-to-diagram direction before designing round-trip editing. In the preview, drag empty canvas space or use two-finger scrolling to pan; click a task to inspect it.
- The editor's `1.1.0` distribution hardcodes drag-to-select even in read-only mode. `npm install` applies the pinned patch in `patches/` so read-only mode pans on drag instead; editable mode keeps its upstream drag-to-select behavior. Remove/review this patch when upgrading the editor.

## Next step

Compare a real workflow (kept out of Git if private) with the samples, and decide whether the DSL adds clarity. Discard the spike if it does not; otherwise test edit mode and export separately.
