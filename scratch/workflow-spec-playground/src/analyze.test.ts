import { describe, expect, it } from 'vitest'
import { load } from 'js-yaml'
import { analyze } from './analyze'
import { examples } from './examples'

describe('workflow samples', () => {
  it.each(examples)('validates and builds a graph for $title', ({ yaml }) => {
    const result = analyze(yaml)
    expect(result.diagnostics).toEqual([])
    expect(result.graph?.nodes.some((node) => node.taskReference)).toBe(true)
    expect(result.graph?.edges.length).toBeGreaterThan(0)
  })

  it.each(examples.filter((example) => example.id !== 'reading-loop'))('declares the decision inputs used by $title', ({ yaml }) => {
    const definition = load(yaml) as {
      input: { schema: { document: { properties: Record<string, unknown>; required: string[] } } }
      do: Array<Record<string, { switch?: Array<Record<string, { when?: string }>> }>>
    }
    const conditions = definition.do.flatMap((task) =>
      Object.values(task).flatMap((config) =>
        config.switch?.flatMap((branch) => Object.values(branch).map((item) => item.when).filter((when): when is string => !!when)) ?? [],
      ),
    )
    expect(conditions.length).toBeGreaterThan(0)
    for (const condition of conditions) {
      const field = condition.match(/\$context\.([a-zA-Z]\w*)/)?.[1]
      expect(field).toBeDefined()
      expect(definition.input.schema.document.properties).toHaveProperty(field!)
      expect(definition.input.schema.document.required).toContain(field)
    }
  })

  it('reports invalid syntax without a graph', () => {
    const result = analyze('document: [broken')
    expect(result.parsed).toBe(false)
    expect(result.graph).toBeNull()
    expect(result.diagnostics.length).toBeGreaterThan(0)
  })

  it('reports schema errors without pretending the draft is valid', () => {
    const result = analyze("document:\n  dsl: '1.0.3'\ndo:\n  - step:\n      set:\n        note: hi\n")
    expect(result.diagnostics.length).toBeGreaterThan(0)
  })
})
