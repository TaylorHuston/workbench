#!/bin/sh
# Optional browser regression: npm run build && sh test/lists-browser.sh
set -eu
cd "$(dirname "$0")/.."
session="markdown-live-lists-$$"
trap 'agent-browser --session "$session" close >/dev/null 2>&1 || true' EXIT
agent-browser --session "$session" open "file://$PWD/test/theme-fixture.html" >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-content')" >/dev/null
result=$(agent-browser --session "$session" eval --stdin <<'JS'
(() => {
  const bullets = [...document.querySelectorAll('.cm-list-marker-bullet')].map(el => el.textContent)
  const ordered = [...document.querySelectorAll('.cm-list-marker-ordered')].map(el => el.textContent)
  const tasks = [...document.querySelectorAll('.cm-list-marker-task')]
  return bullets.includes('•') && ordered.includes('1.') && ordered.includes('2.') && tasks.length === 2 && tasks[1].classList.contains('is-checked')
})()
JS
)
[ "$result" = true ] || { echo "List preview regression failed: $result" >&2; exit 1; }
agent-browser --session "$session" click '.cm-list-marker-ordered' >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-formatting-block-visible')" >/dev/null
result=$(agent-browser --session "$session" eval "document.querySelector('.cm-formatting-block-visible').textContent === '1.'")
[ "$result" = true ] || { echo "List source reveal regression failed: $result" >&2; exit 1; }
echo 'List preview and source reveal regression passed.'
