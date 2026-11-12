#!/bin/sh
# Optional isolated file-route regression; requires agent-browser and installed dependencies.
set -eu
cd "$(dirname "$0")/.."
tmp=$(mktemp -d "${TMPDIR:-/tmp}/pi-workbench-route-test.XXXXXX")
session="pi-workbench-routes-$$"; second="pi-workbench-routes-bookmark-$$"; pid=''
cleanup() {
  agent-browser --session "$session" close >/dev/null 2>&1 || true
  agent-browser --session "$second" close >/dev/null 2>&1 || true
  if [ -n "$pid" ]; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; fi
  rm -rf "$tmp"
}
trap cleanup EXIT HUP INT TERM
mkdir -p "$tmp/app" "$tmp/files" "$tmp/other" "$tmp/home"
npm run build -- --outDir "$tmp/app/dist" --emptyOutDir >/dev/null
cp server.mjs agent.mjs archive.mjs workspaces.mjs extension-ui.mjs test/markdown-fixture-server.mjs "$tmp/app/"
ln -s "$PWD/node_modules" "$tmp/app/node_modules"
printf '# First note\n' > "$tmp/files/first.md"
printf '# Second note\n' > "$tmp/files/second.md"
printf '# Links\n\n[Go second](second.md)\n\n[[second|Wiki second]]\n\n[Web link](https://example.com/)\n\n[Heading](second.md#section)\n' > "$tmp/files/links.md"
printf '# Other note\n' > "$tmp/other/other.md"
env -i PATH="$PATH" HOME="$tmp/home" PI_CODING_AGENT_DIR="$tmp/home/agent" PI_OFFLINE=1 FIXTURE_ROOT="$tmp/files" OTHER_ROOT="$tmp/other" DELAY_FILE='first.md' PORT_FILE="$tmp/port" node "$tmp/app/markdown-fixture-server.mjs" > "$tmp/server.log" 2>&1 & pid=$!
i=0; while [ ! -s "$tmp/port" ]; do i=$((i+1)); [ "$i" -le 10 ] || exit 1; sleep 1; done
read -r port < "$tmp/port" || true
base="http://127.0.0.1:$port"
agent-browser --session "$session" open "$base/" >/dev/null
agent-browser --session "$session" wait --text 'first.md' >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#workspace-select').options.length === 2" >/dev/null
agent-browser --session "$session" find text 'first.md' click --exact >/dev/null
agent-browser --session "$session" wait --fn "new URL(location.href).searchParams.get('file') === 'first.md'" --timeout 5000 >/dev/null || { agent-browser --session "$session" eval "({url:location.href,history:history.state,document:document.querySelector('#filename').textContent,status:document.querySelector('#document-status').textContent,workspace:document.querySelector('#workspace-status').textContent})" >&2; agent-browser --session "$session" errors >&2; exit 1; }
result=$(agent-browser --session "$session" eval "/^[a-f0-9]{64}$/.test(new URL(location.href).searchParams.get('workspace')) && !location.href.includes('/Users/')")
[ "$result" = true ] || { echo 'File URL leaked the workspace path or lacked its ID' >&2; exit 1; }
agent-browser --session "$session" find text 'second.md' click --exact >/dev/null
agent-browser --session "$session" wait --fn "new URL(location.href).searchParams.get('file') === 'second.md'" >/dev/null
agent-browser --session "$session" back >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'first.md' && new URL(location.href).searchParams.get('file') === 'first.md'" >/dev/null
agent-browser --session "$session" forward >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'second.md' && new URL(location.href).searchParams.get('file') === 'second.md'" >/dev/null
agent-browser --session "$session" eval "window.fixturePopCount=0; window.fixtureReads=0; window.fixturePending=0; const originalFetch=window.fetch; window.fetch=(...args)=>{if(String(args[0]).startsWith('/api/file?')){window.fixtureReads++;window.fixturePending++;return originalFetch(...args).finally(()=>window.fixturePending--);}return originalFetch(...args)}; window.addEventListener('popstate',()=>window.fixturePopCount++); history.back(); setTimeout(() => history.forward(), 25); true" >/dev/null
agent-browser --session "$session" wait --fn "window.fixturePopCount >= 2 && window.fixtureReads >= 2 && window.fixturePending === 0 && new URL(location.href).searchParams.get('file') === 'second.md' && document.querySelector('#filename').textContent === 'second.md'" >/dev/null
agent-browser --session "$session" focus '.cm-content' >/dev/null
agent-browser --session "$session" back >/dev/null
agent-browser --session "$session" wait --text 'Opening…' --timeout 5000 >/dev/null
agent-browser --session "$session" keyboard inserttext ' DURING' >/dev/null
agent-browser --session "$session" wait --fn "new URL(location.href).searchParams.get('file') === 'second.md' && document.querySelector('.cm-content').textContent.includes('DURING')" >/dev/null
agent-browser --session "$session" eval "window.confirm=()=>true; document.querySelector('#discard').click(); true" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#save').disabled" >/dev/null
agent-browser --session "$session" reload >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'second.md'" >/dev/null
agent-browser --session "$session" focus '.cm-content' >/dev/null
agent-browser --session "$session" keyboard inserttext ' EDIT' >/dev/null
agent-browser --session "$session" wait --text 'Unsaved changes' >/dev/null
agent-browser --session "$session" eval "window.confirm=()=>false; true" >/dev/null
agent-browser --session "$session" back >/dev/null
agent-browser --session "$session" wait --fn "new URL(location.href).searchParams.get('file') === 'second.md' && document.querySelector('.cm-content').textContent.includes('EDIT')" >/dev/null
agent-browser --session "$session" eval "window.confirm=()=>true; true" >/dev/null
agent-browser --session "$session" back >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'first.md' && new URL(location.href).searchParams.get('file') === 'first.md'" >/dev/null
other=$(cd "$tmp/other" && pwd -P)
other_id=$(node -e "process.stdout.write(require('node:crypto').createHash('sha256').update(process.argv[1]).digest('hex'))" "$other")
agent-browser --session "$session" eval "history.pushState({workbenchIndex:history.state.workbenchIndex+1},'', '/?workspace=$other_id&file=missing.md'); true" >/dev/null
agent-browser --session "$session" back >/dev/null
agent-browser --session "$session" wait --fn "new URL(location.href).searchParams.get('file') === 'first.md'" >/dev/null
agent-browser --session "$session" forward >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#workspace-status').textContent.includes('Could not open') && new URL(location.href).searchParams.get('file') === 'first.md' && document.querySelector('#filename').textContent === 'first.md'" >/dev/null
agent-browser --session "$session" select '#workspace-select' "$other" >/dev/null
agent-browser --session "$session" wait --text 'other.md' >/dev/null
agent-browser --session "$session" find text 'other.md' click --exact >/dev/null
agent-browser --session "$session" wait --fn "new URL(location.href).searchParams.get('file') === 'other.md'" >/dev/null
agent-browser --session "$session" back >/dev/null
agent-browser --session "$session" wait --fn "new URL(location.href).searchParams.get('file') === null && document.querySelector('#document').hidden" >/dev/null
agent-browser --session "$session" back >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'first.md' && new URL(location.href).searchParams.get('file') === 'first.md'" >/dev/null
agent-browser --session "$session" click '#filename' >/dev/null
agent-browser --session "$session" fill '#rename-input' 'renamed.md' >/dev/null
agent-browser --session "$session" press Enter >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#filename').textContent === 'renamed.md' && new URL(location.href).searchParams.get('file') === 'renamed.md'" >/dev/null
id=$(curl -fsS "$base/api/workspace-root" | node -e "let s='';process.stdin.on('data',x=>s+=x);process.stdin.on('end',()=>process.stdout.write(JSON.parse(s).id))")
agent-browser --session "$second" open "$base/?workspace=$id&file=second.md" >/dev/null
agent-browser --session "$second" wait --fn "document.querySelector('#filename').textContent === 'second.md' && document.querySelector('.cm-content').textContent.includes('Second note')" >/dev/null
agent-browser --session "$second" open "$base/?workspace=$other_id&file=other.md" >/dev/null
agent-browser --session "$second" wait --fn "document.querySelector('#filename').textContent === 'other.md' && document.querySelector('.cm-content').textContent.includes('Other note')" --timeout 5000 >/dev/null || { agent-browser --session "$second" eval "({url:location.href, filename:document.querySelector('#filename').textContent, status:document.querySelector('#status').textContent, workspaceStatus:document.querySelector('#workspace-status').textContent, selected:document.querySelector('#workspace-select').value})" >&2; agent-browser --session "$second" errors >&2; exit 1; }
agent-browser --session "$second" open "$base/?workspace=$id&file=missing.md" >/dev/null
agent-browser --session "$second" wait --fn "document.querySelector('#status').textContent.includes('no such file') || document.querySelector('#status').textContent.includes('ENOENT')" --timeout 5000 >/dev/null
agent-browser --session "$second" open "$base/?workspace=bad&file=first.md" >/dev/null
agent-browser --session "$second" wait --fn "document.querySelector('#workspace-status').textContent.includes('invalid')" >/dev/null
agent-browser --session "$second" open "$base/?workspace=ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff&file=first.md" >/dev/null
agent-browser --session "$second" wait --fn "document.querySelector('#workspace-status').textContent.includes('unavailable or archived')" >/dev/null
agent-browser --session "$second" open "$base/?workspace=$id&file=links.md" >/dev/null
agent-browser --session "$second" wait --fn "document.querySelectorAll('.cm-link-widget').length === 4" >/dev/null
agent-browser --session "$second" eval "window.fixtureOpened=''; window.open=(url)=>{window.fixtureOpened=url}; [...document.querySelectorAll('.cm-link-widget')].find(x=>x.textContent==='Web link').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0,metaKey:true})); true" >/dev/null
agent-browser --session "$second" wait --fn "window.fixtureOpened === 'https://example.com/' && document.querySelector('#filename').textContent === 'links.md'" --timeout 5000 >/dev/null
agent-browser --session "$second" eval "[...document.querySelectorAll('.cm-link-widget')].find(x=>x.textContent==='Heading').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0,metaKey:true})); true" >/dev/null
agent-browser --session "$second" wait --fn "document.querySelector('#document-status').textContent.includes('Unsupported') && document.querySelector('#filename').textContent === 'links.md'" --timeout 5000 >/dev/null
agent-browser --session "$second" eval "[...document.querySelectorAll('.cm-link-widget')].find(x=>x.textContent==='Go second').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0,metaKey:true})); true" >/dev/null
agent-browser --session "$second" wait --fn "document.querySelector('#filename').textContent === 'second.md' && new URL(location.href).searchParams.get('file') === 'second.md'" --timeout 5000 >/dev/null
agent-browser --session "$second" back >/dev/null
agent-browser --session "$second" wait --fn "document.querySelector('#filename').textContent === 'links.md' && !!document.querySelector('.cm-wikilink-widget')" >/dev/null
agent-browser --session "$second" eval "document.querySelector('.cm-wikilink-widget').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0,ctrlKey:true})); true" >/dev/null
agent-browser --session "$second" wait --fn "document.querySelector('#filename').textContent === 'second.md'" --timeout 5000 >/dev/null
agent-browser --session "$second" back >/dev/null
agent-browser --session "$second" wait --fn "document.querySelector('#filename').textContent === 'links.md' && !!document.querySelector('.cm-link-widget')" >/dev/null
agent-browser --session "$second" focus '.cm-content' >/dev/null
agent-browser --session "$second" keyboard inserttext 'DRAFT' >/dev/null
agent-browser --session "$second" eval "window.fixtureConfirmCalls=0; window.confirm=()=>{window.fixtureConfirmCalls++;return false}; [...document.querySelectorAll('.cm-link-widget')].find(x=>x.textContent==='Go second').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,button:0,metaKey:true})); true" >/dev/null
agent-browser --session "$second" wait --fn "window.fixtureConfirmCalls > 0 && document.querySelector('#filename').textContent === 'links.md' && document.querySelector('.cm-content').textContent.includes('DRAFT') && document.querySelector('#document-status').textContent.includes('Unsaved')" >/dev/null
agent-browser --session "$second" eval "window.confirm=()=>true; document.querySelector('#discard').click(); true" >/dev/null
agent-browser --session "$second" wait --fn "document.querySelector('#save').disabled" >/dev/null
agent-browser --session "$second" find text 'Go second' click --exact >/dev/null
agent-browser --session "$second" wait --fn "document.querySelector('#filename').textContent === 'links.md' && !!document.querySelector('.cm-link-source')" --timeout 5000 >/dev/null
echo 'File URLs, links, bookmarks, workspace history, unavailable targets, and unsaved-edit guards passed.'
