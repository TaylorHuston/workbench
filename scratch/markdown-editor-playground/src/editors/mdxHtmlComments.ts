const HTML_COMMENT_PATTERN = /<!--([\s\S]*?)-->/g
const HTML_COMMENT_SENTINEL_PATTERN =
  /<MarkdownHtmlComment\s+value=["']([^"']*)["']\s*\/>/g
const CODE_PATTERN = /(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1|`+[^`\n]*`+/g

function mapOutsideCode(source: string, transform: (value: string) => string) {
  let output = ''
  let cursor = 0

  for (const match of source.matchAll(CODE_PATTERN)) {
    const index = match.index ?? 0
    output += transform(source.slice(cursor, index))
    output += match[0]
    cursor = index + match[0].length
  }

  return output + transform(source.slice(cursor))
}

function encodeComment(value: string) {
  return encodeURIComponent(value)
    .replaceAll("'", '%27')
    .replaceAll('*', '%2A')
}

export function decodeHtmlComment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

export function renderHtmlCommentsForMdxEditor(source: string) {
  return mapOutsideCode(source, (value) =>
    value.replace(
      HTML_COMMENT_PATTERN,
      (_match, comment: string) =>
        `<MarkdownHtmlComment value="${encodeComment(comment)}" />`,
    ),
  )
}

export function restoreHtmlCommentsFromMdxEditor(source: string) {
  return mapOutsideCode(source, (value) =>
    value.replace(
      HTML_COMMENT_SENTINEL_PATTERN,
      (_match, encodedComment: string) => {
        const comment = decodeHtmlComment(encodedComment)
        return comment === null ? _match : `<!--${comment}-->`
      },
    ),
  )
}
