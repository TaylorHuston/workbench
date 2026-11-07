#!/bin/sh
# Optional browser regression: npm run build && sh test/theme-browser.sh
set -eu
cd "$(dirname "$0")/.."
session="markdown-live-theme-$$"
trap 'agent-browser --session "$session" close >/dev/null 2>&1 || true' EXIT
agent-browser --session "$session" open "file://$PWD/test/theme-fixture.html" >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-table-editor th') && !!document.querySelector('.hljs-keyword')" >/dev/null
result=$(agent-browser --session "$session" eval --stdin <<'JS'
(() => {
  const root = document.body
  const selectors = ['.cm-header-1', '.cm-strong', '.cm-emphasis', '.cm-code', '.cm-table-editor th', '.hljs-keyword']
  const check = (fg, bg) => selectors.every(selector => {
    const element = document.querySelector(selector)
    return element && getComputedStyle(element).color === fg
  }) && ['.cm-code', '.cm-table-editor th', '.cm-codeblock-widget'].every(selector => {
    const element = document.querySelector(selector)
    return element && getComputedStyle(element).backgroundColor === bg
  })
  const dark = check('rgb(212, 212, 212)', 'rgb(48, 48, 48)')
  root.style.setProperty('--vscode-editor-foreground', '#222222')
  root.style.setProperty('--vscode-editor-background', '#ffffff')
  root.style.setProperty('--vscode-textCodeBlock-background', '#eeeeee')
  const light = check('rgb(34, 34, 34)', 'rgb(238, 238, 238)')
  return dark && light
})()
JS
)
[ "$result" = true ] || { echo "Theme regression failed: $result" >&2; exit 1; }
echo 'Dark/light Markdown theme regression passed.'
