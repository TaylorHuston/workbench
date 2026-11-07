#!/bin/sh
# Optional browser regression: npm run build && sh test/tables-browser.sh
set -eu
cd "$(dirname "$0")/.."
session="markdown-live-tables-$$"
trap 'agent-browser --session "$session" close >/dev/null 2>&1 || true' EXIT
agent-browser --session "$session" open "file://$PWD/test/long-table-fixture.html" >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-scroller')" >/dev/null
agent-browser --session "$session" eval "document.querySelector('.cm-scroller').scrollTop = document.querySelector('.cm-scroller').scrollHeight; true" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('.cm-scroller').scrollTop > 0" >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-table-editor')" --timeout 5000 >/dev/null || { echo 'Table in long document did not render' >&2; exit 1; }
result=$(agent-browser --session "$session" eval --stdin <<'JS'
(() => {
  const cell = document.querySelector('.cm-table-cell')
  const blocked = !cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
  return blocked && document.querySelector('#status').textContent.includes('read-only')
})()
JS
)
[ "$result" = true ] || { echo "Table safety guard failed: $result" >&2; exit 1; }
agent-browser --session "$session" click '.cm-table-toggle' >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-table-source')" --timeout 5000 >/dev/null
echo 'Long-document table rendering and read-only guard passed.'
