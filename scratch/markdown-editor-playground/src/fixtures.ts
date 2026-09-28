export interface Fixture {
  id: string
  label: string
  path: string
  kind: 'Markdown' | 'MDX'
  source: string
}

const files = import.meta.glob<string>('./content/**/*.{md,mdx}', {
  eager: true,
  import: 'default',
  query: '?raw',
})

const labelOverrides: Record<string, string> = {
  'basics/welcome.md': 'Field notebook',
  'mdx/component-sample.mdx': 'MDX component',
  'notes/nested/field-observations.md': 'Nested field notes',
}

export const fixtures: Fixture[] = Object.entries(files)
  .map(([modulePath, source]) => {
    const path = modulePath.replace('./content/', '')

    return {
      id: path,
      label: labelOverrides[path] ?? path,
      path: `src/content/${path}`,
      kind: path.endsWith('.mdx') ? 'MDX' : 'Markdown',
      source,
    } satisfies Fixture
  })
  .sort((a, b) => a.path.localeCompare(b.path))
