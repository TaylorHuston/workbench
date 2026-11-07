const vscode = require('vscode')
const { classifyEdit } = require('./protocol.cjs')
const { parseWikilinkTarget, resolveWikiLink } = require('./wikilinkResolver.cjs')

function activate(context) {
  const panels = new Map()
  const pendingJumps = new Map()
  let nextJumpId = 0, navigationGeneration = 0
  function deliverJump(record) {
    const jump = pendingJumps.get(record.key)
    if (jump && record.ready && record.panel.active) record.panel.webview.postMessage({ type: 'jump-to-fragment', ...jump })
  }
  context.subscriptions.push(vscode.window.registerCustomEditorProvider('markdownLive.editor', {
    async resolveCustomTextEditor(document, panel) {
      panel.webview.options = { enableScripts: true }
      const script = panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'editor.js'))
      const nonce = require('crypto').randomBytes(16).toString('hex')
      panel.webview.html = `<!doctype html><html><head><meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style nonce="${nonce}">
          html,body,#editor { height:100%; margin:0; padding:0 }
          body { color:var(--vscode-editor-foreground); background:var(--vscode-editor-background); font-family:var(--vscode-font-family) }
          #editor { box-sizing:border-box; height:100%; }
          #status { display:none; padding:10px 18px; background:var(--vscode-inputValidation-warningBackground); color:var(--vscode-inputValidation-warningForeground); border-bottom:1px solid var(--vscode-inputValidation-warningBorder) }
          #status.visible { display:block } body:has(#status.visible) #editor { height:calc(100% - 60px) }
          .cm-editor { height:100%; } .cm-scroller { overflow:auto; }
        </style></head><body><div id="status" role="alert"></div><main id="editor"></main>
        <script nonce="${nonce}" src="${script}"></script></body></html>`
      const send = message => panel.webview.postMessage(message)
      const key = document.uri.toString()
      const record = { key, panel, ready: false }
      if (!panels.has(key)) panels.set(key, new Set())
      panels.get(key).add(record)
      panel.onDidChangeViewState(() => deliverJump(record))
      const changes = vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.uri.toString() === document.uri.toString()) send({ type: 'document', text: document.getText() })
      })
      panel.onDidDispose(() => {
        changes.dispose()
        panels.get(key)?.delete(record)
        if (!panels.get(key)?.size) panels.delete(key)
      })
      panel.webview.onDidReceiveMessage(async message => {
        if (message.type === 'ready') { record.ready = true; send({ type: 'document', text: document.getText() }); deliverJump(record); return }
        if (message.type === 'jump-result') {
          if (pendingJumps.get(key)?.id === message.id) pendingJumps.delete(key)
          return
        }
        if (message.type === 'follow-wikilink' && typeof message.target === 'string' && typeof message.base === 'string') {
          if (document.getText() !== message.base) { send({ type: 'navigation-error', message: 'The note changed before navigation. Resolve the edit conflict and try again.' }); return }
          const generation = ++navigationGeneration
          pendingJumps.clear()
          try {
            const target = parseWikilinkTarget(message.target)
            if (target.kind !== 'target') { send({ type: 'navigation-error', message: 'This heading or block link is not supported.' }); return }
            const result = target.note ? await resolveWikiLink(vscode, document.uri, target.note) : { kind: 'found', uri: document.uri }
            if (generation !== navigationGeneration) return
            if (document.getText() !== message.base) { send({ type: 'navigation-error', message: 'The note changed before navigation. Try again.' }); return }
            if (result.kind === 'found') {
              const targetKey = result.uri.toString()
              const jump = target.fragment ? { id: ++nextJumpId, fragment: target.fragment } : null
              if (jump) pendingJumps.set(targetKey, jump)
              try {
                if (targetKey !== key) await vscode.commands.executeCommand('vscode.openWith', result.uri, 'markdownLive.editor', { viewColumn: vscode.ViewColumn.Active, preview: false })
                if (jump) for (const candidate of panels.get(targetKey) ?? []) deliverJump(candidate)
              } catch (error) {
                if (jump && pendingJumps.get(targetKey)?.id === jump.id) pendingJumps.delete(targetKey)
                throw error
              }
            } else {
              const messages = {
                ambiguous: 'More than one note matches this link. Use a more specific path.',
                missing: 'No existing note matches this link in this workspace.',
                unsupported: 'This wikilink target is not supported.',
                'unsupported-workspace': 'Open a local workspace folder to follow wikilinks.',
                invalid: 'This link cannot be opened within the current workspace.',
              }
              send({ type: 'navigation-error', message: messages[result.kind] || 'The link could not be resolved.' })
            }
          } catch {
            send({ type: 'navigation-error', message: 'Could not resolve or open the linked note.' })
          }
          return
        }
        if (message.type !== 'edit' || typeof message.base !== 'string' || typeof message.text !== 'string') return
        const current = document.getText()
        const decision = classifyEdit(current, message.base, message.text)
        if (decision === 'conflict') { send({ type: 'conflict' }); return }
        if (decision === 'apply') {
          const edit = new vscode.WorkspaceEdit()
          edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(current.length)), message.text)
          const ok = await vscode.workspace.applyEdit(edit)
          if (!ok) { send({ type: 'conflict' }); return }
        }
        const actual = document.getText()
        if (actual !== message.text) { send({ type: 'conflict' }); return }
        send({ type: 'ack', text: actual })
      })
    },
  }, { supportsMultipleEditorsPerDocument: true }))
}
module.exports = { activate }
