#!/bin/sh
# Optional browser regression: npm run build && sh test/frontmatter-browser.sh
set -eu
cd "$(dirname "$0")/.."
session="markdown-live-frontmatter-$$"
trap 'agent-browser --session "$session" close >/dev/null 2>&1 || true' EXIT
agent-browser --session "$session" open "file://$PWD/test/frontmatter-fixture.html" >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-content')" >/dev/null
result=$(agent-browser --session "$session" eval --stdin <<'JS'
(() => {
  const delimiters = [...document.querySelectorAll('.cm-frontmatter-delimiter')]
  const close = delimiters[1]?.querySelector('.cm-formatting-block')
  return delimiters.length === 2 && close && getComputedStyle(close).opacity === '1' && parseFloat(getComputedStyle(close).fontSize) > 5 &&
    !!document.querySelector('.cm-frontmatter-toggle') && !window.outbound.some(message => message.type === 'edit')
})()
JS
)
[ "$result" = true ] || { echo "Frontmatter delimiter regression failed: $result" >&2; exit 1; }
agent-browser --session "$session" click '.cm-frontmatter-toggle' >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-frontmatter-collapsed')" --timeout 5000 >/dev/null
result=$(agent-browser --session "$session" eval "!document.querySelector('.cm-content').textContent.includes('title: Example') && !window.outbound.some(message => message.type === 'edit')")
[ "$result" = true ] || { echo "Frontmatter collapse failed: $result" >&2; exit 1; }
agent-browser --session "$session" click '.cm-frontmatter-toggle' >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('.cm-content').textContent.includes('title: Example')" --timeout 5000 >/dev/null
result=$(agent-browser --session "$session" eval "!window.outbound.some(message => message.type === 'edit')")
[ "$result" = true ] || { echo "Frontmatter expand modified the document: $result" >&2; exit 1; }
agent-browser --session "$session" eval "window.postMessage({type:'document',text:'# Plain note\\n\\nNo properties.\\n'}, '*'); true" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('.cm-content').textContent.includes('Plain note')" >/dev/null
result=$(agent-browser --session "$session" eval "!document.querySelector('.cm-frontmatter-toggle') && !window.outbound.some(message => message.type === 'edit')")
[ "$result" = true ] || { echo "Plain note unexpectedly gained a properties control: $result" >&2; exit 1; }
echo 'Frontmatter delimiter, collapse, expand and source preservation passed.'
