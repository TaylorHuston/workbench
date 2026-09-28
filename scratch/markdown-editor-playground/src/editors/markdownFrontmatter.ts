export const MARKDOWN_FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

export interface MarkdownFrontmatter {
  body: string
  yaml: string | null
}

export function splitMarkdownFrontmatter(source: string): MarkdownFrontmatter {
  const match = source.match(MARKDOWN_FRONTMATTER_PATTERN)

  if (!match) {
    return { body: source, yaml: null }
  }

  return {
    body: source.slice(match[0].length).replace(/^\r?\n/, ''),
    yaml: match[1] ?? '',
  }
}

export function joinMarkdownFrontmatter(
  yaml: string | null,
  body: string,
): string {
  if (yaml === null) return body

  return `---\n${yaml}\n---\n\n${body.replace(/^\r?\n+/, '')}`
}
