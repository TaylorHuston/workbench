import { useEffect, type RefObject } from 'react'
import { MARKDOWN_FRONTMATTER_PATTERN } from './markdownFrontmatter'

const WIKILINK_HREF_PREFIX = '#wikilink='
const WIKILINK_PATTERN = /(?<!!)\[\[([^\]\n]+)\]\]/g
const SENTINEL_LINK_PATTERN = /\[([^\]]*(?:\\.[^\]]*)*)\]\((?:<)?#wikilink=([^)>\s]+)(?:>)?\)/g
const CODE_PATTERN = /(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1|`+[^`\n]*`+/g

function mapOutsideCode(source: string, transform: (value: string) => string) {
  const frontmatter = source.match(MARKDOWN_FRONTMATTER_PATTERN)?.[0] ?? ''
  const body = source.slice(frontmatter.length)
  let output = frontmatter
  let cursor = 0

  for (const match of body.matchAll(CODE_PATTERN)) {
    const index = match.index ?? 0
    output += transform(body.slice(cursor, index))
    output += match[0]
    cursor = index + match[0].length
  }

  return output + transform(body.slice(cursor))
}

function escapeLinkLabel(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]')
}

function unescapeLinkLabel(value: string) {
  return value.replace(/\\(\\|\[|\])/g, '$1')
}

export function renderWikilinksForEditor(source: string) {
  return mapOutsideCode(source, (value) =>
    value.replace(WIKILINK_PATTERN, (_match, contents: string) => {
      const [rawTarget, ...aliasParts] = contents.split('|')
      const target = rawTarget?.trim()
      if (!target) return _match

      const alias = aliasParts.join('|').trim()
      const label = alias || target
      return `[${escapeLinkLabel(label)}](${WIKILINK_HREF_PREFIX}${encodeURIComponent(target)})`
    }),
  )
}

export function restoreWikilinksFromEditor(source: string) {
  return mapOutsideCode(source, (value) =>
    value.replace(
      SENTINEL_LINK_PATTERN,
      (_match, rawLabel: string, encodedTarget: string) => {
        let target: string
        try {
          target = decodeURIComponent(encodedTarget)
        } catch {
          return _match
        }

        const label = unescapeLinkLabel(rawLabel)
        return label === target
          ? `[[${target}]]`
          : `[[${target}|${label}]]`
      },
    ),
  )
}

export function useWikilinkNavigation(
  hostRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const preventNavigation = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const link = target.closest<HTMLAnchorElement>('a[href^="#wikilink="]')
      if (!link) return

      event.preventDefault()
      event.stopImmediatePropagation()
    }

    host.addEventListener('pointerdown', preventNavigation, { capture: true })
    host.addEventListener('click', preventNavigation, { capture: true })
    return () => {
      host.removeEventListener('pointerdown', preventNavigation, {
        capture: true,
      })
      host.removeEventListener('click', preventNavigation, { capture: true })
    }
  }, [hostRef])
}
