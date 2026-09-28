import { load } from 'js-yaml'

export type WorkflowProperty = { name: string; type: string; required: boolean; options: string[] }
export type WorkflowProperties = { kind: 'none' | 'inline' | 'external'; fields: WorkflowProperty[] }

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

// This is a compact view of workflow input.schema, not a general JSON Schema renderer.
export function getWorkflowProperties(source: string): WorkflowProperties {
  try {
    const workflow = asRecord(load(source))
    const schema = asRecord(asRecord(workflow?.input)?.schema)
    if (!schema) return { kind: 'none', fields: [] }
    const document = asRecord(schema.document)
    if (!document) return { kind: schema.resource ? 'external' : 'none', fields: [] }

    const definitions = asRecord(document.properties)
    const required = new Set(Array.isArray(document.required) ? document.required : [])
    const fields = Object.entries(definitions ?? {}).map(([name, definition]) => {
      const property = asRecord(definition)
      const type = typeof property?.type === 'string' ? property.type : 'unspecified'
      const options = Array.isArray(property?.enum)
        ? property.enum.filter((option): option is string | number | boolean =>
          typeof option === 'string' || typeof option === 'number' || typeof option === 'boolean',
        ).map(String)
        : []
      return { name, type, required: required.has(name), options }
    })
    return { kind: 'inline', fields }
  } catch {
    return { kind: 'none', fields: [] }
  }
}
