const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const Module = require('node:module')

test('host opens only a uniquely resolved note while source is current', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'markdown-wikilink-host-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await fs.writeFile(path.join(root, 'source.md'), '# Source')
  await fs.writeFile(path.join(root, 'target.md'), '# Target')
  const uri = fsPath => ({ fsPath, scheme: 'file', toString: () => fsPath })
  const folder = { uri: uri(root) }, opened = [], messages = []
  let provider, receiver
  const vscode = {
    workspace: {
      getWorkspaceFolder: () => folder,
      findFiles: async () => [uri(path.join(root, 'target.md'))],
      onDidChangeTextDocument: () => ({ dispose() {} }),
    },
    Uri: { joinPath: () => ({}) }, RelativePattern: class {}, ViewColumn: { Active: 1 },
    window: { registerCustomEditorProvider: (_id, p) => { provider = p; return {} } },
    commands: { executeCommand: async (...args) => opened.push(args) },
  }
  const original = Module._load
  Module._load = function (request, ...args) { return request === 'vscode' ? vscode : original.call(this, request, ...args) }
  let extension
  try { extension = require('../src/extension.cjs') } finally { Module._load = original }
  extension.activate({ subscriptions: [], extensionUri: {} })
  const panel = { active: true, webview: { asWebviewUri: () => 'local-script', postMessage: m => messages.push(m), onDidReceiveMessage: f => { receiver = f } }, onDidChangeViewState() {}, onDidDispose() {} }
  let current = '# Source'
  const doc = { uri: uri(path.join(root, 'source.md')), getText: () => current }
  await provider.resolveCustomTextEditor(doc, panel)
  await receiver({ type: 'ready' })
  await receiver({ type: 'follow-wikilink', target: '#Source', base: '# Source' })
  assert.equal(opened.length, 0)
  assert.equal(messages.at(-1).type, 'jump-to-fragment')
  assert.equal(messages.at(-1).fragment, 'Source')
  await receiver({ type: 'jump-result', id: messages.at(-1).id })
  await receiver({ type: 'follow-wikilink', target: 'target', base: '# Source' })
  assert.equal(opened.length, 1)
  assert.equal(opened[0][0], 'vscode.openWith')
  assert.equal(opened[0][1].fsPath, path.join(root, 'target.md'))
  assert.equal(opened[0][2], 'markdownLive.editor')
  assert.equal(opened[0][3].preview, false)
  await receiver({ type: 'follow-wikilink', target: 'target#^block-1', base: '# Source' })
  assert.equal(opened.length, 2)
  const sourceReceiver = receiver
  const destinationMessages = []
  let destinationReceiver
  const destinationPanel = { active: true, webview: { asWebviewUri: () => 'local-script', postMessage: m => destinationMessages.push(m), onDidReceiveMessage: f => { destinationReceiver = f } }, onDidChangeViewState() {}, onDidDispose() {} }
  await provider.resolveCustomTextEditor({ uri: uri(path.join(root, 'target.md')), getText: () => '# Target' }, destinationPanel)
  await destinationReceiver({ type: 'ready' })
  assert.equal(destinationMessages[0].type, 'document')
  assert.equal(destinationMessages[1].type, 'jump-to-fragment')
  assert.equal(destinationMessages[1].fragment, '^block-1')
  await destinationReceiver({ type: 'jump-result', id: destinationMessages[1].id })
  receiver = sourceReceiver
  await receiver({ type: 'follow-wikilink', target: 'target#Target', base: '# Source' })
  assert.equal(opened.length, 3)
  assert.equal(destinationMessages.at(-1).type, 'jump-to-fragment')
  assert.equal(destinationMessages.at(-1).fragment, 'Target')
  await receiver({ type: 'follow-wikilink', target: 'target', base: 'stale' })
  assert.equal(opened.length, 3)
  assert.equal(messages.at(-1).type, 'navigation-error')
  await receiver({ type: 'follow-wikilink', target: 'missing', base: '# Source' })
  assert.equal(opened.length, 3)
  assert.match(messages.at(-1).message, /No existing note/)
  let finish
  vscode.workspace.findFiles = () => new Promise(resolve => { finish = resolve })
  const pending = receiver({ type: 'follow-wikilink', target: 'target', base: '# Source' })
  // Allow the asynchronous realpath checks to reach file discovery.
  while (!finish) await new Promise(resolve => setImmediate(resolve))
  current = '# Source changed'
  finish([uri(path.join(root, 'target.md'))])
  await pending
  assert.equal(opened.length, 3)
  assert.match(messages.at(-1).message, /changed before navigation/)
})
