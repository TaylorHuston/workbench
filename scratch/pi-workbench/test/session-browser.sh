#!/bin/sh
# Isolated session/editor experiment. Uses fake sessions and makes no model calls.
set -eu
cd "$(dirname "$0")/.."
tmp=$(mktemp -d "${TMPDIR:-/tmp}/pi-workbench-session-test.XXXXXX")
session="pi-workbench-session-$$"; pid=''
cleanup() { agent-browser --session "$session" close >/dev/null 2>&1 || true; if [ -n "$pid" ]; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; fi; rm -rf "$tmp"; }
trap cleanup EXIT HUP INT TERM
mkdir -p "$tmp/app" "$tmp/files" "$tmp/home"
npm run build -- --outDir "$tmp/app/dist" --emptyOutDir >/dev/null
cp server.mjs agent.mjs archive.mjs workspaces.mjs extension-ui.mjs test/markdown-fixture-server.mjs "$tmp/app/"
ln -s "$PWD/node_modules" "$tmp/app/node_modules"
printf '# First note\n' > "$tmp/files/first.md"
printf '# Second note\n' > "$tmp/files/second.md"
env -i PATH="$PATH" HOME="$tmp/home" PI_CODING_AGENT_DIR="$tmp/home/agent" PI_OFFLINE=1 FIXTURE_ROOT="$tmp/files" FIXTURE_SESSIONS=1 FIXTURE_DELAY_SNAPSHOT=1 PORT_FILE="$tmp/port" node "$tmp/app/markdown-fixture-server.mjs" > "$tmp/server.log" 2>&1 & pid=$!
i=0; while [ ! -s "$tmp/port" ]; do i=$((i+1)); [ "$i" -le 10 ] || exit 1; sleep 1; done
read -r port < "$tmp/port" || true
base="http://127.0.0.1:$port"; one=$(printf '%064d' 0 | tr '0' 'a'); two=$(printf '%064d' 0 | tr '0' 'b'); three=$(printf '%064d' 0 | tr '0' 'c')
agent-browser --session "$session" open "$base/" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#session-select').options.length === 3 && !document.querySelector('#session-select').disabled" >/dev/null
result=$(agent-browser --session "$session" eval "(() => { const f=document.querySelector('#files-view').getBoundingClientRect(), a=document.querySelector('#agent-view').getBoundingClientRect(); return f.width>0 && a.width>0 && a.left>=f.right-1; })()")
[ "$result" = true ] || { echo 'Editor and session are not side by side' >&2; exit 1; }
agent-browser --session "$session" select '#session-select' "$one" >/dev/null
agent-browser --session "$session" wait --fn "new URL(location.href).searchParams.get('session') === '$one' && document.querySelector('#agent-status').textContent === 'Ready'" >/dev/null
agent-browser --session "$session" eval "document.querySelector('#session-select').add(new Option('Locked fixture', 'd'.repeat(64))); true" >/dev/null
locked=$(printf '%064d' 0 | tr '0' 'd')
agent-browser --session "$session" select '#session-select' "$locked" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#agent-status').textContent.includes('stale Workbench lock')" >/dev/null
agent-browser --session "$session" select '#session-select' "$one" >/dev/null
agent-browser --session "$session" wait --fn "!document.querySelector('#agent-status').textContent.includes('stale Workbench lock')" >/dev/null
agent-browser --session "$session" click '#session-manage' >/dev/null
agent-browser --session "$session" wait --fn "!document.querySelector('#session-manager').hidden && document.querySelector('#session-manage').getAttribute('aria-expanded') === 'true'" >/dev/null
agent-browser --session "$session" screenshot /tmp/pi-workbench-session-menu.png >/dev/null
agent-browser --session "$session" eval "window.prompt=()=> 'Renamed session'; true" >/dev/null
agent-browser --session "$session" click '#session-rename' >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#session-select').selectedOptions[0].textContent === 'Renamed session'" >/dev/null
agent-browser --session "$session" click '#agent-reload' >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#agent-status').textContent === 'Ready'" >/dev/null
agent-browser --session "$session" click '#session-archive-current' >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#session-archive-current').textContent === 'Restore' && document.querySelector('.archived-sessions')" >/dev/null
agent-browser --session "$session" select '#session-select' "$two" >/dev/null
agent-browser --session "$session" wait --fn "new URL(location.href).searchParams.get('session') === '$two'" >/dev/null
agent-browser --session "$session" click '.archived-sessions summary' >/dev/null
agent-browser --session "$session" click '.archived-sessions .session-archive' >/dev/null
agent-browser --session "$session" wait --fn "!document.querySelector('.archived-sessions') && [...document.querySelector('#session-select').options].some(option => option.value === '$one')" >/dev/null
agent-browser --session "$session" select '#session-select' "$one" >/dev/null
agent-browser --session "$session" wait --fn "new URL(location.href).searchParams.get('session') === '$one'" >/dev/null
agent-browser --session "$session" click '#session-manage' >/dev/null
agent-browser --session "$session" find text 'second.md' click --exact >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'second.md' && new URL(location.href).searchParams.get('session') === '$one'" >/dev/null
agent-browser --session "$session" screenshot /tmp/pi-workbench-session-layout.png >/dev/null
agent-browser --session "$session" select '#session-select' "$two" >/dev/null
agent-browser --session "$session" wait --fn "new URL(location.href).searchParams.get('session') === '$two' && document.querySelector('#document').hidden" >/dev/null
agent-browser --session "$session" find text 'first.md' click --exact >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'first.md'" >/dev/null
agent-browser --session "$session" select '#session-select' "$one" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'second.md' && new URL(location.href).searchParams.get('session') === '$one'" >/dev/null
agent-browser --session "$session" back >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'first.md' && new URL(location.href).searchParams.get('session') === '$two'" >/dev/null
agent-browser --session "$session" forward >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'second.md' && new URL(location.href).searchParams.get('session') === '$one'" >/dev/null
agent-browser --session "$session" focus '.cm-content' >/dev/null
agent-browser --session "$session" keyboard inserttext ' DRAFT' >/dev/null
agent-browser --session "$session" back >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#session-change-dialog').open" >/dev/null
result=$(agent-browser --session "$session" eval "[...document.querySelectorAll('#session-change-dialog button')].map(button => button.value).join(',') === 'save,discard,cancel' && document.activeElement.value === 'cancel'")
[ "$result" = true ] || { echo 'Session dialog button order or safe default is incorrect' >&2; exit 1; }
agent-browser --session "$session" screenshot /tmp/pi-workbench-session-confirm.png >/dev/null
agent-browser --session "$session" click '#session-change-dialog button[value=cancel]' >/dev/null
agent-browser --session "$session" wait --fn "new URL(location.href).searchParams.get('session') === '$one' && document.querySelector('.cm-content').textContent.includes('DRAFT')" >/dev/null
agent-browser --session "$session" select '#session-select' "$two" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#session-change-dialog').open" >/dev/null
agent-browser --session "$session" click '#session-change-dialog button[value=cancel]' >/dev/null
agent-browser --session "$session" wait --fn "!document.querySelector('#session-change-dialog').open && document.querySelector('#session-select').value === '$one' && document.querySelector('.cm-content').textContent.includes('DRAFT')" >/dev/null
agent-browser --session "$session" select '#session-select' "$two" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#session-change-dialog').open" >/dev/null
agent-browser --session "$session" eval "document.querySelector('#agent-message').value='new draft'; true" >/dev/null
agent-browser --session "$session" click '#session-change-dialog button[value=discard]' >/dev/null
agent-browser --session "$session" wait --fn "!document.querySelector('#session-change-dialog').open && document.querySelector('#session-select').value === '$one' && document.querySelector('.cm-content').textContent.includes('DRAFT')" >/dev/null
agent-browser --session "$session" fill '#agent-message' '' >/dev/null
agent-browser --session "$session" select '#session-select' "$two" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#session-change-dialog').open" >/dev/null
agent-browser --session "$session" click '#session-change-dialog button[value=discard]' >/dev/null
agent-browser --session "$session" wait --fn "new URL(location.href).searchParams.get('session') === '$two' && document.querySelector('#filename').textContent === 'first.md'" >/dev/null
[ "$(tr -d '\n' < "$tmp/files/second.md")" = '# Second note' ] || { echo 'Discard wrote to disk' >&2; exit 1; }
agent-browser --session "$session" select '#session-select' "$one" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'second.md'" >/dev/null
agent-browser --session "$session" focus '.cm-content' >/dev/null
agent-browser --session "$session" keyboard inserttext ' SAVED' >/dev/null
agent-browser --session "$session" select '#session-select' "$two" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#session-change-dialog').open" >/dev/null
agent-browser --session "$session" click '#session-change-dialog button[value=save]' >/dev/null
agent-browser --session "$session" wait --fn "new URL(location.href).searchParams.get('session') === '$two' && document.querySelector('#filename').textContent === 'first.md'" >/dev/null
grep -q 'SAVED' "$tmp/files/second.md" || { echo 'Save did not write before switching' >&2; exit 1; }
agent-browser --session "$session" select '#session-select' "$one" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'second.md'" >/dev/null
cp "$tmp/files/second.md" "$tmp/saved.md"
printf '# External change\n' > "$tmp/files/second.md"
agent-browser --session "$session" focus '.cm-content' >/dev/null
agent-browser --session "$session" keyboard inserttext ' DRAFT' >/dev/null
agent-browser --session "$session" select '#session-select' "$two" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#session-change-dialog').open" >/dev/null
agent-browser --session "$session" click '#session-change-dialog button[value=save]' >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#document-status').textContent.includes('changed on disk') && document.querySelector('#session-select').value === '$one' && document.querySelector('.cm-content').textContent.includes('DRAFT')" >/dev/null
[ "$(tr -d '\n' < "$tmp/files/second.md")" = '# External change' ] || { echo 'Conflict overwrote external change' >&2; exit 1; }
cp "$tmp/saved.md" "$tmp/files/second.md"
agent-browser --session "$session" fill '#agent-message' 'fixture question' >/dev/null
agent-browser --session "$session" click '#agent-send' >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#agent-status').textContent.includes('Save or discard')" >/dev/null
agent-browser --session "$session" eval "window.confirm=()=>true; document.querySelector('#discard').click(); true" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#save').disabled" >/dev/null
agent-browser --session "$session" click '#agent-send' >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#agent-message').value === ''" >/dev/null
agent-browser --session "$session" click '#session-new' >/dev/null
agent-browser --session "$session" wait --fn "new URL(location.href).searchParams.get('session') === '$three' && document.querySelector('#filename').textContent === 'second.md'" >/dev/null
agent-browser --session "$session" select '#session-select' "$one" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'second.md'" >/dev/null
agent-browser --session "$session" reload >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'second.md' && new URL(location.href).searchParams.get('session') === '$one' && !document.querySelector('#agent-status').textContent.includes('stale Workbench lock')" >/dev/null
agent-browser --session "$session" eval "localStorage.setItem('pi-workbench:session-document:$two', '{bad'); true" >/dev/null
agent-browser --session "$session" select '#session-select' "$two" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#document-status').textContent.includes('Could not read') && document.querySelector('#filename').textContent === 'second.md'" >/dev/null
agent-browser --session "$session" fill '#agent-message' 'fixture question' >/dev/null
agent-browser --session "$session" click '#agent-send' >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#agent-status').textContent.includes('not ready') && localStorage.getItem('pi-workbench:session-document:$two') === '{bad'" >/dev/null
echo 'Session picker, split view, document restoration, draft guard, context, inheritance, bookmark, and corrupt-storage protection passed.'
