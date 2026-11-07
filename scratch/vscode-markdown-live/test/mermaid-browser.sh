#!/bin/sh
# Optional browser regression: npm run build && sh test/mermaid-browser.sh
set -eu
cd "$(dirname "$0")/.."
session="markdown-live-mermaid-$$"
trap 'agent-browser --session "$session" close >/dev/null 2>&1 || true' EXIT
agent-browser --session "$session" open "file://$PWD/test/mermaid-fixture.html" >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-mermaid-preview svg') && !!document.querySelector('.cm-mermaid-preview p')" --timeout 20000 >/dev/null
result=$(agent-browser --session "$session" eval --stdin <<'JS'
(() => {
  const previews = document.querySelectorAll('.cm-mermaid-preview')
  const label = previews[0].querySelector('svg').textContent
  return previews.length === 2 && label.includes('Start') && label.includes('here') && !label.includes('<br') &&
    previews[1].textContent.includes('could not be rendered') && previews[1].querySelector('pre').textContent.includes('not valid') &&
    !!document.querySelector('.cm-codeblock-widget') && !window.outbound.some(message => message.type === 'edit')
})()
JS
)
[ "$result" = true ] || { echo "Mermaid rendering regression failed: $result" >&2; exit 1; }
agent-browser --session "$session" click '.cm-mermaid-toolbar button' >/dev/null
agent-browser --session "$session" wait --fn "[...document.querySelectorAll('.cm-line')].some(e => e.textContent.includes('flowchart TD'))" --timeout 5000 >/dev/null
result=$(agent-browser --session "$session" eval "[...document.querySelectorAll('.cm-line')].some(e => e.textContent.includes('flowchart TD')) && !window.outbound.some(message => message.type === 'edit')")
[ "$result" = true ] || { echo "Mermaid source reveal regression failed: $result" >&2; exit 1; }
agent-browser --session "$session" click '.cm-header-1' >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-mermaid-preview svg')" --timeout 20000 >/dev/null
result=$(agent-browser --session "$session" eval "!window.outbound.some(message => message.type === 'edit')")
[ "$result" = true ] || { echo "Viewing Mermaid changed the source: $result" >&2; exit 1; }
echo 'Mermaid render, invalid fallback, source reveal and source preservation passed.'
