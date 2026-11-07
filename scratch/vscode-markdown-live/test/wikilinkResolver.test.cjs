const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { selectTarget, resolveWikiLink } = require('../src/wikilinkResolver.cjs')

const files = ['a/start.md', 'a/topic.md', 'b/topic.md', 'b/unique.md', 'nested/path/child.md']
test('resolves unique bare names and explicit paths, but not duplicates', () => {
  assert.deepEqual(selectTarget('unique', 'a/start.md', files), { kind: 'found', path: 'b/unique.md' })
  assert.deepEqual(selectTarget('topic', 'a/start.md', files), { kind: 'ambiguous' })
  assert.deepEqual(selectTarget('./topic', 'a/start.md', files), { kind: 'found', path: 'a/topic.md' })
  assert.deepEqual(selectTarget('../b/unique.md', 'a/start.md', files), { kind: 'found', path: 'b/unique.md' })
  assert.deepEqual(selectTarget('path/child', 'a/start.md', files), { kind: 'found', path: 'nested/path/child.md' })
})
test('refuses escapes, schemes, unresolved fragments and missing files', () => {
  for (const target of ['../../outside', '/outside', 'file:///tmp/a', 'x\\y']) assert.equal(selectTarget(target, 'a/start.md', files).kind, 'invalid')
  for (const target of ['topic#Heading', '#Heading', 'topic#^block']) assert.equal(selectTarget(target, 'a/start.md', files).kind, 'unsupported')
  assert.equal(selectTarget('missing', 'a/start.md', files).kind, 'missing')
})
test('physical workspace containment rejects symlink escapes', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'markdown-wikilink-test-'))
  const workspace = path.join(root, 'workspace')
  await fs.mkdir(workspace)
  const source = path.join(workspace, 'start.md')
  const target = path.join(workspace, 'target.md')
  const outside = path.join(root, 'outside.md')
  const symlink = path.join(workspace, 'link.md')
  await Promise.all([fs.writeFile(source, ''), fs.writeFile(target, ''), fs.writeFile(outside, '')])
  await fs.symlink(outside, symlink)
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  const uri = fsPath => ({ fsPath, scheme: 'file' })
  const folder = { uri: uri(workspace) }
  const vscode = { workspace: { getWorkspaceFolder: () => folder, findFiles: async () => [uri(target), uri(symlink)] }, RelativePattern: class {} }
  assert.equal((await resolveWikiLink(vscode, uri(source), 'target')).kind, 'found')
  assert.equal((await resolveWikiLink(vscode, uri(source), 'link')).kind, 'invalid')
})
