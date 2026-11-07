const vscode = require('vscode')
const { classifyEdit } = require('./protocol.cjs')

function activate(context) {
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
      const changes = vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.uri.toString() === document.uri.toString()) send({ type: 'document', text: document.getText() })
      })
      panel.onDidDispose(() => changes.dispose())
      panel.webview.onDidReceiveMessage(async message => {
        if (message.type === 'ready') { send({ type: 'document', text: document.getText() }); return }
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
