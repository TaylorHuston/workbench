const { test } = require('node:test')
const assert = require('node:assert/strict')
const { findFragment } = require('../src/wikilinkFragment.cjs')
const { parseWikilinkTarget } = require('../src/wikilinkResolver.cjs')

test('parses note, same-note, heading and block destinations', () => {
  assert.deepEqual(parseWikilinkTarget('notes/topic#My Heading'), { kind: 'target', note: 'notes/topic', fragment: 'My Heading' })
  assert.deepEqual(parseWikilinkTarget('#^abc-123'), { kind: 'target', note: '', fragment: '^abc-123' })
  assert.deepEqual(parseWikilinkTarget('topic'), { kind: 'target', note: 'topic', fragment: null })
  for (const target of ['note#', '#', 'note#heading#child', 'note#^bad id']) assert.equal(parseWikilinkTarget(target).kind, 'unsupported')
})
test('locates headings and block IDs but ignores frontmatter and fenced code', () => {
  const text = '---\ntitle: fake ^hidden\n---\n# **First** heading\n\nParagraph. ^block-123\n\n```md\n# Decoy\nword ^code-id\n```\n\nAnother title\n---\n'
  assert.deepEqual(findFragment(text, 'first heading'), { kind: 'found', position: text.indexOf('# **First**') })
  assert.deepEqual(findFragment(text, '^block-123'), { kind: 'found', position: text.indexOf('Paragraph.') })
  assert.deepEqual(findFragment(text, 'Another title'), { kind: 'found', position: text.indexOf('Another title') })
  for (const target of ['^hidden', 'Decoy', '^code-id']) assert.equal(findFragment(text, target).kind, 'missing')
})
test('does not guess missing, ambiguous or unsupported destinations', () => {
  assert.equal(findFragment('# Same\n## Same\n', 'Same').kind, 'ambiguous')
  assert.equal(findFragment('a ^id\nb ^id\n', '^id').kind, 'ambiguous')
  assert.equal(findFragment('# Heading\n', 'unknown').kind, 'missing')
  assert.equal(findFragment('# Heading\n', 'heading#child').kind, 'unsupported')
})
