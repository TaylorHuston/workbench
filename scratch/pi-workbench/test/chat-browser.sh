#!/bin/sh
# Isolated chat rendering test: fake sessions and events; no provider or model calls.
set -eu
cd "$(dirname "$0")/.."
tmp=$(mktemp -d "${TMPDIR:-/tmp}/pi-workbench-chat-test.XXXXXX")
session="pi-workbench-chat-$$"; pid=''
cleanup() { agent-browser --session "$session" close >/dev/null 2>&1 || true; if [ -n "$pid" ]; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; fi; rm -rf "$tmp"; }
trap cleanup EXIT HUP INT TERM
mkdir -p "$tmp/app" "$tmp/files" "$tmp/home"
npm run build -- --outDir "$tmp/app/dist" --emptyOutDir >/dev/null
cp server.mjs agent.mjs archive.mjs workspaces.mjs extension-ui.mjs test/markdown-fixture-server.mjs "$tmp/app/"
ln -s "$PWD/node_modules" "$tmp/app/node_modules"
env -i PATH="$PATH" HOME="$tmp/home" PI_CODING_AGENT_DIR="$tmp/home/agent" PI_OFFLINE=1 FIXTURE_ROOT="$tmp/files" FIXTURE_SESSIONS=1 FIXTURE_CHAT=1 PORT_FILE="$tmp/port" node "$tmp/app/markdown-fixture-server.mjs" > "$tmp/server.log" 2>&1 & pid=$!
i=0; while [ ! -s "$tmp/port" ]; do i=$((i+1)); [ "$i" -le 10 ] || exit 1; sleep 1; done
read -r port < "$tmp/port" || true
one=$(printf '%064d' 0 | tr '0' 'a')
agent-browser --session "$session" open "http://127.0.0.1:$port/" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#session-select').options.length === 3 && !document.querySelector('#session-select').disabled" >/dev/null
agent-browser --session "$session" select '#session-select' "$one" >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.agent-message.assistant .message-body table')" --timeout 5000 >/dev/null
result=$(agent-browser --session "$session" eval --stdin <<'JS'
(() => {
  const body = document.querySelector('.agent-message.assistant .message-body');
  const user = document.querySelector('.agent-message.user .message-body');
  const link = body.querySelector('a');
  return body.querySelector('h1')?.textContent === 'Summary' &&
    body.querySelector('strong')?.textContent === 'Bold' && body.querySelector('em')?.textContent === 'italic' &&
    body.querySelector('code')?.textContent === 'inline' && body.querySelector('del')?.textContent === 'removed' && body.querySelectorAll('li').length === 2 &&
    body.querySelector('input[type=checkbox]')?.disabled && body.querySelector('input[type=checkbox]')?.checked && body.querySelector('blockquote')?.textContent === 'A quote' &&
    body.querySelector('table tbody td')?.textContent === 'Item' && body.querySelector('pre code')?.textContent === 'const value = 1;' &&
    link?.href === 'https://example.com/?a=1&b=2' && link.target === '_blank' && link.rel.includes('noopener') &&
    body.querySelectorAll('a').length === 1 && !body.querySelector('img, iframe, script, [onerror]') &&
    body.textContent.includes('<img src=x') && body.textContent.includes('Remote') && !window.fixtureXss &&
    user.querySelector('strong')?.textContent === 'Question' && user.textContent === 'Question & answer';
})()
JS
)
[ "$result" = true ] || { echo "Chat Markdown or safety regression: $result" >&2; exit 1; }
agent-browser --session "$session" screenshot /tmp/pi-workbench-chat-markdown.png >/dev/null
agent-browser --session "$session" fill '#agent-message' 'stream chat' >/dev/null
agent-browser --session "$session" click '#agent-send' >/dev/null
agent-browser --session "$session" wait --fn "[...document.querySelectorAll('.agent-message.assistant .message-body')].some(node => node.textContent === 'Streaming' && node.querySelector('strong')?.textContent === 'Streaming')" --timeout 1500 >/dev/null
agent-browser --session "$session" wait --fn "[...document.querySelectorAll('.agent-message.assistant .message-body')].some(node => node.textContent === 'Streaming response')" --timeout 5000 >/dev/null
result=$(agent-browser --session "$session" eval "[...document.querySelectorAll('.agent-message.assistant .message-body')].filter(node => node.textContent.includes('Streaming')).length === 1")
[ "$result" = true ] || { echo 'Streaming message duplicated' >&2; exit 1; }
agent-browser --session "$session" reload >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.agent-message.assistant .message-body table')" --timeout 5000 >/dev/null
echo 'Saved and streaming chat Markdown, safe links, and inert HTML/images passed.'
