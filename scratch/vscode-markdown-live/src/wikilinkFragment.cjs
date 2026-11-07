function normalizedHeading(value) {
  return value.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ').trim().toLocaleLowerCase()
}

// Return a UTF-16 position in the current, unmodified editor text. Fenced
// code and YAML properties are not heading/block destinations.
function findFragment(text, fragment) {
  if (typeof fragment !== 'string' || !fragment.trim() || fragment.includes('#')) return { kind: 'unsupported' }
  const block = fragment.startsWith('^')
  const query = block ? fragment.slice(1) : normalizedHeading(fragment)
  if (!query || (block && !/^[a-zA-Z0-9-]+$/.test(query))) return { kind: 'unsupported' }
  const lines = text.split('\n')
  let offset = 0, fence = null, frontmatter = lines[0]?.replace(/^\uFEFF/, '').trim() === '---'
  const matches = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '')
    if (frontmatter) {
      if (i > 0 && line.trim() === '---') frontmatter = false
      offset += lines[i].length + 1
      continue
    }
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (marker) {
      const chars = marker[1]
      if (!fence) fence = chars
      else if (chars[0] === fence[0] && chars.length >= fence.length && /^\s*$/.test(line.slice(marker[0].length))) fence = null
      offset += lines[i].length + 1
      continue
    }
    if (!fence && !/^( {4}|\t)/.test(line)) {
      if (block) {
        const match = line.match(/(?:^|\s)\^([a-zA-Z0-9-]+)\s*$/)
        if (match && match[1] === query) matches.push(offset)
      } else {
        const heading = line.match(/^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/)
        if (heading && normalizedHeading(heading[1]) === query) matches.push(offset)
        else if (i + 1 < lines.length && /^ {0,3}(?:=+|-+)[ \t]*\r?$/.test(lines[i + 1]) && line.trim() && normalizedHeading(line) === query) matches.push(offset)
      }
    }
    offset += lines[i].length + 1
  }
  return matches.length === 1 ? { kind: 'found', position: matches[0] } : { kind: matches.length ? 'ambiguous' : 'missing' }
}
module.exports = { findFragment }
