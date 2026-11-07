#!/bin/sh
# Optional browser regression: npm run build && sh test/nonstandard-table-browser.sh
set -eu
cd "$(dirname "$0")/.."
session="markdown-live-nonstandard-table-$$"
trap 'agent-browser --session "$session" close >/dev/null 2>&1 || true' EXIT
agent-browser --session "$session" open "file://$PWD/test/nonstandard-table-fixture.html" >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-content')" >/dev/null
result=$(agent-browser --session "$session" eval --stdin <<'JS'
(() => {
  const rows = [...document.querySelectorAll('.cm-table-fallback tr')]
  return document.querySelectorAll('.cm-table-fallback').length === 1 && rows.length === 3 && rows.every(row => row.cells.length === 4) &&
    rows[1].cells[1].textContent.includes('Note label') && rows[1].cells[2].textContent === 'Active' &&
    rows[1].cells[3].querySelector('br') && rows[2].cells[1].textContent.includes('left|right') &&
    rows[2].cells[3].textContent.includes('Keep | here') &&
    !window.outbound.some(message => message.type === 'edit')
})()
JS
)
[ "$result" = true ] || { echo "Nonstandard table preview failed: $result" >&2; exit 1; }
agent-browser --session "$session" click '.cm-table-fallback button' >/dev/null
agent-browser --session "$session" wait --fn "[...document.querySelectorAll('.cm-line')].some(line => line.textContent.includes('| --- | --- | --- | --- | --- | --- |'))" --timeout 5000 >/dev/null
result=$(agent-browser --session "$session" eval "!window.outbound.some(message => message.type === 'edit')")
[ "$result" = true ] || { echo "Table source reveal changed the document: $result" >&2; exit 1; }
echo 'Nonstandard table preview, wikilinks, line breaks and source preservation passed.'
