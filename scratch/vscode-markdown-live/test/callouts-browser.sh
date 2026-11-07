#!/bin/sh
# Optional browser regression: npm run build && sh test/callouts-browser.sh
set -eu
cd "$(dirname "$0")/.."
session="markdown-live-callouts-$$"
trap 'agent-browser --session "$session" close >/dev/null 2>&1 || true' EXIT
agent-browser --session "$session" open "file://$PWD/test/callout-fixture.html" >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-content')" >/dev/null
result=$(agent-browser --session "$session" eval --stdin <<'JS'
(() => {
  const lines = [...document.querySelectorAll('.cm-callout-line')]
  const info = lines.filter(line => line.classList.contains('cm-callout-info'))
  const warning = lines.filter(line => line.classList.contains('cm-callout-warning'))
  return info.length === 3 && warning.length === 2 &&
    info[0].textContent.includes('Current state') && !info[0].textContent.includes('[!info]') &&
    warning[0].textContent.includes('Warning') && !warning[0].textContent.includes('[!warning]') &&
    ![...document.querySelectorAll('.cm-callout-line')].some(line => line.textContent.includes('ordinary quote')) &&
    !window.outbound.some(message => message.type === 'edit')
})()
JS
)
[ "$result" = true ] || { echo "Callout preview regression failed: $result" >&2; exit 1; }
agent-browser --session "$session" click '.cm-callout-info.cm-callout-title' >/dev/null
agent-browser --session "$session" wait --fn "[...document.querySelectorAll('.cm-line')].some(e=>e.textContent.includes('[!info]'))" --timeout 5000 >/dev/null
result=$(agent-browser --session "$session" eval "!window.outbound.some(message => message.type === 'edit')")
[ "$result" = true ] || { echo "Viewing callouts changed the source: $result" >&2; exit 1; }
echo 'Callout rendering, source reveal and source preservation passed.'
