#!/bin/sh
# Isolated code-editor regression; fake sessions, no provider calls or real files.
set -eu
cd "$(dirname "$0")/.."
tmp=$(mktemp -d "${TMPDIR:-/tmp}/pi-workbench-code-test.XXXXXX")
session="pi-workbench-code-$$"; bookmark="pi-workbench-code-bookmark-$$"; pid=''
cleanup() { agent-browser --session "$session" close >/dev/null 2>&1 || true; agent-browser --session "$bookmark" close >/dev/null 2>&1 || true; if [ -n "$pid" ]; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; fi; rm -rf "$tmp"; }
trap cleanup EXIT HUP INT TERM
mkdir -p "$tmp/app" "$tmp/files" "$tmp/home"
npm run build -- --outDir "$tmp/app/dist" --emptyOutDir >/dev/null
cp server.mjs agent.mjs archive.mjs workspaces.mjs extension-ui.mjs test/markdown-fixture-server.mjs "$tmp/app/"
ln -s "$PWD/node_modules" "$tmp/app/node_modules"
printf 'export const answer: number = 42;\r\n' > "$tmp/files/app.ts"
printf '# Fixture\n\n[Open code](app.ts)\n' > "$tmp/files/README.md"
printf 'ordinary unknown text\n' > "$tmp/files/notes.unknown"
printf 'fixture' > "$tmp/files/.env.test"
printf '\377\000\201' > "$tmp/files/image.bin"
cp "$tmp/files/image.bin" "$tmp/binary-original"
env -i PATH="$PATH" HOME="$tmp/home" PI_CODING_AGENT_DIR="$tmp/home/agent" PI_OFFLINE=1 FIXTURE_ROOT="$tmp/files" FIXTURE_SESSIONS=1 FIXTURE_CODE=1 PORT_FILE="$tmp/port" node "$tmp/app/markdown-fixture-server.mjs" > "$tmp/server.log" 2>&1 & pid=$!
i=0; while [ ! -s "$tmp/port" ]; do i=$((i+1)); [ "$i" -le 10 ] || exit 1; sleep 1; done
read -r port < "$tmp/port" || true
base="http://127.0.0.1:$port"; one=$(printf '%064d' 0 | tr '0' 'a'); two=$(printf '%064d' 0 | tr '0' 'b')
agent-browser --session "$session" open "$base/" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#session-select').options.length === 3 && !!document.querySelector('[data-entry=\"app.ts\"]')" >/dev/null
result=$(agent-browser --session "$session" eval "!document.querySelector('[data-entry=\".env.test\"]') && !!document.querySelector('[data-entry=\"image.bin\"]')")
[ "$result" = true ] || { echo 'Protected or binary file listing is incorrect' >&2; exit 1; }
agent-browser --session "$session" select '#session-select' "$one" >/dev/null
agent-browser --session "$session" wait --fn "new URL(location.href).searchParams.get('session') === '$one'" >/dev/null
agent-browser --session "$session" find text 'app.ts' click --exact >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'app.ts' && document.querySelector('.document-kind').textContent === 'TypeScript file' && !!document.querySelector('.cm-line span')" --timeout 5000 >/dev/null
result=$(agent-browser --session "$session" eval "!document.querySelector('.cm-table-editor, .cm-frontmatter-toggle, .cm-list-marker-bullet') && document.querySelector('.cm-content').getAttribute('aria-label') === 'TypeScript source editor'")
[ "$result" = true ] || { echo 'Code editor used Markdown preview or did not identify its language' >&2; exit 1; }
agent-browser --session "$session" screenshot /tmp/pi-workbench-code-editor.png >/dev/null
agent-browser --session "$session" focus '.cm-content' >/dev/null
agent-browser --session "$session" press Meta+End >/dev/null
agent-browser --session "$session" keyboard inserttext '// edit' >/dev/null
agent-browser --session "$session" wait --fn "!document.querySelector('#save').disabled" >/dev/null
agent-browser --session "$session" click '#save' >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#save').disabled && document.querySelector('#document-status').textContent === 'Saved'" >/dev/null
node -e "const b=require('node:fs').readFileSync(process.argv[1],'utf8');if(b!=='export const answer: number = 42;\r\n// edit')process.exit(1)" "$tmp/files/app.ts"
agent-browser --session "$session" fill '#agent-message' 'fixture question' >/dev/null
agent-browser --session "$session" click '#agent-send' >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#agent-message').value === ''" >/dev/null
agent-browser --session "$session" select '#session-select' "$two" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#document').hidden && new URL(location.href).searchParams.get('session') === '$two'" >/dev/null
agent-browser --session "$session" select '#session-select' "$one" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'app.ts' && document.querySelector('.cm-content').textContent.includes('// edit')" >/dev/null
agent-browser --session "$session" find text 'notes.unknown' click --exact >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('.document-kind').textContent === 'Plain text file' && document.querySelector('.cm-content').textContent.includes('ordinary unknown text')" >/dev/null
agent-browser --session "$session" find text 'image.bin' click --exact >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#document-status').textContent.includes('Binary') && document.querySelector('#filename').textContent === 'notes.unknown'" >/dev/null
cmp "$tmp/binary-original" "$tmp/files/image.bin"
agent-browser --session "$session" find text 'README.md' click --exact >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-link-widget')" >/dev/null
agent-browser --session "$session" eval "document.querySelector('.cm-link-widget').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0,metaKey:true})); true" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'app.ts' && document.querySelector('.document-kind').textContent === 'TypeScript file'" --timeout 5000 >/dev/null
id=$(curl -fsS "$base/api/workspace-root" | node -e "let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>process.stdout.write(JSON.parse(s).id))")
[ "$(curl -s -o /dev/null -w '%{http_code}' "$base/api/file?workspace=$(node -p 'encodeURIComponent(process.argv[1])' "$tmp/files")&path=.env.test")" = 400 ] || { echo 'Protected file was accessible' >&2; exit 1; }
agent-browser --session "$bookmark" open "$base/?workspace=$id&file=app.ts" >/dev/null
agent-browser --session "$bookmark" wait --fn "document.querySelector('#filename').textContent === 'app.ts' && document.querySelector('.document-kind').textContent === 'TypeScript file'" --timeout 5000 >/dev/null
echo 'Text and code browsing, syntax, save, session context, restoration, safe rejection, links, and bookmarks passed.'
