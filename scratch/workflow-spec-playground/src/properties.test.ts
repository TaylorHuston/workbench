import { describe, expect, it } from 'vitest'
import { examples } from './examples'
import { getWorkflowProperties } from './properties'

describe('workflow input properties', () => {
  it('reads named required fields and allowed values from the idea sample', () => {
    expect(getWorkflowProperties(examples[0].yaml)).toEqual({
      kind: 'inline',
      fields: [{ name: 'priority', type: 'string', required: true, options: ['now', 'later'] }],
    })
  })

  it('reads a boolean input from the weekly sample', () => {
    expect(getWorkflowProperties(examples[1].yaml).fields).toEqual([
      { name: 'needsFollowUp', type: 'boolean', required: true, options: [] },
    ])
  })

  it('handles missing and externally defined schemas without inventing fields', () => {
    expect(getWorkflowProperties(examples[2].yaml)).toEqual({ kind: 'none', fields: [] })
    expect(getWorkflowProperties('input:\n  schema:\n    format: json\n    resource:\n      endpoint: https://example.com/schema.json\n')).toEqual({ kind: 'external', fields: [] })
  })

  it('reads JSON and optional fields', () => {
    expect(getWorkflowProperties(JSON.stringify({ input: { schema: { document: { properties: { count: { type: 'integer' } } } } } }))).toEqual({
      kind: 'inline',
      fields: [{ name: 'count', type: 'integer', required: false, options: [] }],
    })
  })
})
