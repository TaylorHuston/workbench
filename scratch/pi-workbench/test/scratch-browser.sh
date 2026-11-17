#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
tmp=$(mktemp -d "${TMPDIR:-/tmp}/pi-workbench-scratch-test.XXXXXX"); session="pi-workbench-scratch-$$"; pid=''
cleanup() { agent-browser --session "$session" close >/dev/null 2>&1 || true; if [ -n "$pid" ]; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; fi; rm -rf "$tmp"; }
trap cleanup EXIT HUP INT TERM
mkdir -p "$tmp/app" "$tmp/files" "$tmp/home"
npm run build -- --outDir "$tmp/app/dist" --emptyOutDir >/dev/null
cp server.mjs agent.mjs archive.mjs workspaces.mjs extension-ui.mjs scratch-store.mjs test/markdown-fixture-server.mjs "$tmp/app/"
ln -s "$PWD/node_modules" "$tmp/app/node_modules"
printf '# Original document\n' > "$tmp/files/first.md"
env -i PATH="$PATH" HOME="$tmp/home" PI_CODING_AGENT_DIR="$tmp/home/agent" PI_OFFLINE=1 FIXTURE_ROOT="$tmp/files" FIXTURE_SESSIONS=1 FIXTURE_SCRATCH=1 PORT_FILE="$tmp/port" node "$tmp/app/markdown-fixture-server.mjs" > "$tmp/server.log" 2>&1 & pid=$!
i=0; while [ ! -s "$tmp/port" ]; do i=$((i+1)); [ "$i" -le 10 ] || exit 1; sleep 1; done
read -r port < "$tmp/port" || true
one=$(printf '%064d' 0 | tr '0' 'a'); two=$(printf '%064d' 0 | tr '0' 'b')
agent-browser --session "$session" open "http://127.0.0.1:$port/" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#session-select').options.length === 3 && !document.querySelector('#session-select').disabled" >/dev/null
agent-browser --session "$session" select '#session-select' "$one" >/dev/null
agent-browser --session "$session" wait --fn "!document.querySelector('#scratch-tab').disabled" >/dev/null
agent-browser --session "$session" find text 'first.md' click --exact >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'first.md'" >/dev/null
agent-browser --session "$session" click '#scratch-tab' >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('#scratch-editor .cm-content')" >/dev/null
agent-browser --session "$session" focus '#scratch-editor .cm-content' >/dev/null
agent-browser --session "$session" keyboard inserttext '# Scratch draft' >/dev/null
agent-browser --session "$session" fill '#agent-message' 'fixture question' >/dev/null
agent-browser --session "$session" click '#agent-send' >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#agent-message').value === '' && document.querySelector('#scratch-save').disabled" --timeout 5000 >/dev/null
file="$tmp/home/agent/pi-workbench/scratch/$one.md"
grep -q 'Scratch draft' "$file"
agent-browser --session "$session" focus '#scratch-editor .cm-content' >/dev/null
agent-browser --session "$session" keyboard inserttext ' MORE' >/dev/null
agent-browser --session "$session" screenshot /tmp/pi-workbench-scratch-pilot.png >/dev/null
agent-browser --session "$session" click '#editor-tab' >/dev/null
agent-browser --session "$session" focus '#editor .cm-content' >/dev/null
agent-browser --session "$session" keyboard inserttext ' DOCUMENT-DRAFT' >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#editor .cm-content').textContent.includes('DOCUMENT-DRAFT') && !document.querySelector('#save').disabled" >/dev/null
agent-browser --session "$session" click '#scratch-tab' >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#scratch-editor .cm-content').textContent.includes('Scratch draft') && !document.querySelector('#scratch-save').disabled" >/dev/null
agent-browser --session "$session" select '#session-select' "$two" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#session-change-dialog').open && document.querySelector('#session-change-title').textContent.includes('scratch')" >/dev/null
agent-browser --session "$session" click '#session-change-dialog button[value=cancel]' >/dev/null
agent-browser --session "$session" wait --fn "!document.querySelector('#session-change-dialog').open && document.querySelector('#session-select').value === '$one'" >/dev/null
file="$tmp/home/agent/pi-workbench/scratch/$one.md"
printf 'Agent changed this\n' > "$file"
agent-browser --session "$session" eval "window.dispatchEvent(new Event('focus')); true" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#scratch-status').textContent.includes('changed on disk')" >/dev/null
agent-browser --session "$session" fill '#agent-message' 'fixture question' >/dev/null
agent-browser --session "$session" click '#agent-send' >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#agent-error').textContent.includes('Could not save scratch') && document.querySelector('#agent-message').value === 'fixture question'" >/dev/null
agent-browser --session "$session" fill '#agent-message' '' >/dev/null
agent-browser --session "$session" click '#scratch-save' >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#scratch-status').textContent.includes('changed on disk') && document.querySelector('#scratch-editor .cm-content').textContent.includes('Scratch draft')" >/dev/null
[ "$(tr -d '\n' < "$file")" = 'Agent changed this' ]
agent-browser --session "$session" eval "window.confirm=()=>true; document.querySelector('#scratch-discard').click(); true" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#scratch-editor .cm-content').textContent.includes('Agent changed this') && document.querySelector('#scratch-save').disabled" >/dev/null
agent-browser --session "$session" focus '#scratch-editor .cm-content' >/dev/null
agent-browser --session "$session" press Meta+End >/dev/null
agent-browser --session "$session" keyboard inserttext ' USER' >/dev/null
agent-browser --session "$session" click '#scratch-save' >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#scratch-save').disabled && document.querySelector('#scratch-status').textContent === 'Saved'" >/dev/null
grep -q USER "$file"
agent-browser --session "$session" select '#session-select' "$two" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#session-change-dialog').open && document.querySelector('#session-change-title').textContent.includes('document')" >/dev/null
agent-browser --session "$session" click '#session-change-dialog button[value=discard]' >/dev/null
agent-browser --session "$session" wait --fn "new URL(location.href).searchParams.get('session') === '$two'" >/dev/null
agent-browser --session "$session" click '#scratch-tab' >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#scratch-path').textContent.endsWith('$two.md') && !document.querySelector('#scratch-editor .cm-content').textContent.includes('USER')" >/dev/null
agent-browser --session "$session" select '#session-select' "$one" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#scratch-path').textContent.endsWith('$one.md') && document.querySelector('#scratch-editor .cm-content').textContent.includes('USER')" >/dev/null
echo 'Scratch tabs, two drafts, session guards, conflict preservation, and restoration passed.'
