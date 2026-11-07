const path = require('node:path')
const fs = require('node:fs/promises')

function parseWikilinkTarget(target) {
  const value = target.trim()
  const index = value.indexOf('#')
  if (index < 0) return value ? { kind: 'target', note: value, fragment: null } : { kind: 'unsupported' }
  const note = value.slice(0, index).trim()
  const fragment = value.slice(index + 1).trim()
  if (!fragment || fragment.includes('#') || (fragment.startsWith('^') && !/^\^[a-zA-Z0-9-]+$/.test(fragment))) return { kind: 'unsupported' }
  return { kind: 'target', note, fragment }
}

// Pick only an unambiguous existing note. Paths are workspace-relative and
// case-sensitive; explicit relative links cannot escape the workspace.
function selectTarget(target, sourcePath, files) {
  const link = target.trim()
  if (!link || link.includes('#')) return { kind: 'unsupported' }
  if (/^[a-z][a-z0-9+.-]*:/i.test(link) || link.startsWith('/') || link.includes('\\') || link.includes('\0')) return { kind: 'invalid' }
  const name = /\.md$/i.test(link) ? link : `${link}.md`
  if (path.posix.extname(name).toLowerCase() !== '.md') return { kind: 'invalid' }
  const explicitRelative = name.startsWith('./') || name.startsWith('../')
  const candidate = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), name))
  if (explicitRelative && (candidate === '..' || candidate.startsWith('../'))) return { kind: 'invalid' }
  const unique = matches => matches.length === 1 ? { kind: 'found', path: matches[0] } : matches.length ? { kind: 'ambiguous' } : null
  if (explicitRelative) return unique(files.filter(file => file === candidate)) ?? { kind: 'missing' }
  if (name.includes('/')) {
    const normalized = path.posix.normalize(name)
    if (normalized === '..' || normalized.startsWith('../')) return { kind: 'invalid' }
    const exact = unique(files.filter(file => file === candidate || file === normalized))
    if (exact) return exact
    return unique(files.filter(file => file.endsWith(`/${normalized}`))) ?? { kind: 'missing' }
  }
  return unique(files.filter(file => path.posix.basename(file) === name)) ?? { kind: 'missing' }
}

async function resolveWikiLink(vscode, source, target) {
  const folder = vscode.workspace.getWorkspaceFolder(source)
  if (!folder || folder.uri.scheme !== 'file' || source.scheme !== 'file') return { kind: 'unsupported-workspace' }
  const root = await fs.realpath(folder.uri.fsPath)
  const sourceReal = await fs.realpath(source.fsPath)
  const isInside = value => { const rel = path.relative(root, value); return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel) }
  if (!isInside(sourceReal)) return { kind: 'invalid' }
  const sourcePath = path.relative(folder.uri.fsPath, source.fsPath).split(path.sep).join('/')
  const uris = await vscode.workspace.findFiles(new vscode.RelativePattern(folder, '**/*.md'), '**/{node_modules,.git}/**')
  const entries = uris.map(uri => ({ uri, path: path.relative(folder.uri.fsPath, uri.fsPath).split(path.sep).join('/') }))
    .filter(entry => entry.path !== '..' && !entry.path.startsWith('../') && !path.isAbsolute(entry.path))
  const result = selectTarget(target, sourcePath, entries.map(entry => entry.path))
  if (result.kind !== 'found') return result
  const selected = entries.find(entry => entry.path === result.path)
  if (!selected || !isInside(await fs.realpath(selected.uri.fsPath))) return { kind: 'invalid' }
  return { kind: 'found', uri: selected.uri }
}
module.exports = { parseWikilinkTarget, selectTarget, resolveWikiLink }
