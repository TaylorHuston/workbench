#!/bin/sh
# Optional browser regression; requires agent-browser and installed dependencies.
set -eu
cd "$(dirname "$0")/.."
tmp=$(mktemp -d "${TMPDIR:-/tmp}/pi-workbench-markdown-test.XXXXXX")
session="pi-workbench-markdown-$$"
pid=''
cleanup() {
  agent-browser --session "$session" close >/dev/null 2>&1 || true
  if [ -n "$pid" ]; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; fi
  rm -rf "$tmp"
}
trap cleanup EXIT HUP INT TERM
mkdir -p "$tmp/app" "$tmp/files" "$tmp/home"
npm run build -- --outDir "$tmp/app/dist" --emptyOutDir >/dev/null
cp server.mjs agent.mjs archive.mjs workspaces.mjs extension-ui.mjs "$tmp/app/"
cp test/markdown-fixture-server.mjs "$tmp/app/"
ln -s "$PWD/node_modules" "$tmp/app/node_modules"
cp test/fixtures/markdown-preview.md "$tmp/files/preview.md"
cp "$tmp/files/preview.md" "$tmp/original.md"
node -e "const fs=require('node:fs');fs.writeFileSync(process.argv[1], '# Long\\n\\n'+Array.from({length:300},(_,i)=>'Line '+i+'\\n\\n').join('')+'| A | B |\\n| --- | --- |\\n| One | '+String.fromCharCode(96)+'end_code'+String.fromCharCode(96)+' |\\n');fs.writeFileSync(process.argv[2], '\\uFEFF---\\ntags:\\n  - alpha\\n---\\n\\n# Note\\n')" "$tmp/files/long.md" "$tmp/files/bom.md"
env -i PATH="$PATH" HOME="$tmp/home" PI_CODING_AGENT_DIR="$tmp/home/agent" PI_OFFLINE=1 FIXTURE_ROOT="$tmp/files" PORT_FILE="$tmp/port" node "$tmp/app/markdown-fixture-server.mjs" > "$tmp/server.log" 2>&1 & pid=$!
i=0
while [ ! -s "$tmp/port" ]; do i=$((i+1)); [ "$i" -le 10 ] || { echo 'Fixture server did not start' >&2; exit 1; }; sleep 1; done
read -r port < "$tmp/port" || true
agent-browser --session "$session" open "http://127.0.0.1:$port/" >/dev/null
agent-browser --session "$session" wait --text 'preview.md' >/dev/null
agent-browser --session "$session" find text 'preview.md' click --exact >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-table-fallback')" >/dev/null
result=$(agent-browser --session "$session" eval --stdin <<'JS'
(() => {
  const bullets = [...document.querySelectorAll('.cm-list-marker-bullet')];
  const tasks = [...document.querySelectorAll('.cm-list-marker-task')];
  const rows = [...document.querySelectorAll('.cm-table-fallback tr')];
  const cell = document.querySelector('.cm-table-cell');
  const standardCode = document.querySelectorAll('.cm-table-editor code');
  const fallbackCode = rows[2]?.cells[1].querySelector('code');
  const standardCell = standardCode[1]?.closest('.cm-table-cell');
  standardCell?.dispatchEvent(new FocusEvent('blur', { bubbles: false }));
  const blocked = ['mousedown', 'beforeinput', 'paste', 'drop'].every(type => !cell.dispatchEvent(new Event(type, { bubbles: true, cancelable: true })));
  return bullets.length >= 2 && tasks.length === 2 && tasks[1].classList.contains('is-checked') &&
    !!document.querySelector('.cm-frontmatter-toggle') && !!document.querySelector('.cm-table-editor') &&
    rows.length === 3 && rows.every(row => row.cells.length === 4) &&
    rows[1].cells[1].textContent.includes('Note label') && !!rows[1].cells[3].querySelector('br') &&
    rows[2].cells[1].textContent.includes('left|right') && rows[2].cells[3].textContent.includes('Keep | here') &&
    standardCode.length === 4 && standardCode[0].innerText === 'State' && standardCode[1].innerText === 'ready_value' &&
    standardCode[2].innerText === 'two ` ticks' && standardCode[3].innerText === 'safe' && !document.querySelector('.cm-table-editor img') &&
    standardCell?.textContent === '`ready_value`' && !standardCell.isContentEditable &&
    fallbackCode?.innerText === 'left|right' && blocked && document.querySelector('#document-status').textContent.includes('read-only') && document.querySelector('#save').disabled;
})()
JS
)
[ "$result" = true ] || { echo "Markdown preview regression failed: $result" >&2; exit 1; }
agent-browser --session "$session" click '.cm-code' >/dev/null
agent-browser --session "$session" wait --fn "(() => { const line = [...document.querySelectorAll('.cm-line')].find(node => node.textContent.includes('inlineword')); const marks = [...line.querySelectorAll('.cm-inline-code-delimiter .cm-formatting-inline')]; return marks.length === 2 && marks.every(mark => getComputedStyle(mark).opacity === '1'); })()" --timeout 5000 >/dev/null || { echo 'Inline-code delimiters did not reveal on click' >&2; exit 1; }
agent-browser --session "$session" eval "document.querySelectorAll('.cm-code').forEach(node => { if (node.textContent.includes('nestedword')) node.id = 'fixture-nested-code'; }); true" >/dev/null
agent-browser --session "$session" click '#fixture-nested-code' >/dev/null
agent-browser --session "$session" wait --fn "(() => { const line = [...document.querySelectorAll('.cm-line')].find(node => node.textContent.includes('nestedword')); const marks = [...line.querySelectorAll('.cm-inline-code-delimiter .cm-formatting-inline')]; return marks.length === 2 && marks.every(mark => getComputedStyle(mark).opacity === '1'); })()" --timeout 5000 >/dev/null || { echo 'Nested inline-code delimiters did not reveal on click' >&2; exit 1; }
result=$(agent-browser --session "$session" eval "(() => { const previous = [...document.querySelectorAll('.cm-line')].find(line => line.textContent.includes('inlineword')); return !previous.querySelector('.cm-inline-code-delimiter') && document.querySelector('#save').disabled; })()")
[ "$result" = true ] || { echo 'Inline-code delimiters did not hide again or changed the document' >&2; exit 1; }
agent-browser --session "$session" keyboard inserttext 'Z' >/dev/null
agent-browser --session "$session" wait --text 'Unsaved changes' >/dev/null
agent-browser --session "$session" press Meta+z >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#save').disabled" >/dev/null
agent-browser --session "$session" click '.cm-list-marker-ordered' >/dev/null
agent-browser --session "$session" wait --fn "[...document.querySelectorAll('.cm-line')].some(line => line.textContent.includes('First ordered') && line.querySelector('.cm-formatting-block-visible'))" >/dev/null
result=$(agent-browser --session "$session" eval "[...document.querySelectorAll('.cm-line')].find(line => line.textContent.includes('First ordered')).querySelector('.cm-formatting-block-visible').textContent === '1.' && document.querySelector('#save').disabled")
[ "$result" = true ] || { echo 'List source reveal failed or changed the document' >&2; exit 1; }
agent-browser --session "$session" click '.cm-frontmatter-toggle' >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-frontmatter-collapsed')" >/dev/null
result=$(agent-browser --session "$session" eval "!document.querySelector('.cm-content').textContent.includes('title: Example') && document.querySelector('#save').disabled")
[ "$result" = true ] || { echo 'Frontmatter collapse changed the document' >&2; exit 1; }
agent-browser --session "$session" click '.cm-frontmatter-toggle' >/dev/null
agent-browser --session "$session" wait --text 'title: Example' >/dev/null
agent-browser --session "$session" click '.cm-table-fallback button' >/dev/null
agent-browser --session "$session" wait --fn "[...document.querySelectorAll('.cm-line')].some(line => line.textContent.includes('| --- | --- | --- | --- | --- | --- |'))" >/dev/null
result=$(agent-browser --session "$session" eval "document.querySelector('#save').disabled")
[ "$result" = true ] || { echo 'Revealing table source changed the document' >&2; exit 1; }
cmp "$tmp/files/preview.md" "$tmp/original.md"
agent-browser --session "$session" focus '.cm-content' >/dev/null
agent-browser --session "$session" wait --fn "document.activeElement.classList.contains('cm-content')" >/dev/null
agent-browser --session "$session" press Meta+End >/dev/null
agent-browser --session "$session" keyboard inserttext ' UI addition.' >/dev/null
agent-browser --session "$session" wait --text 'Unsaved changes' >/dev/null
agent-browser --session "$session" eval "document.querySelector('#save').click(); true" >/dev/null
agent-browser --session "$session" wait --text 'Saved' --timeout 5000 >/dev/null || { agent-browser --session "$session" eval "({status:document.querySelector('#document-status').textContent, saveDisabled:document.querySelector('#save').disabled})" >&2; exit 1; }
node -e "const fs=require('node:fs');const before=fs.readFileSync(process.argv[1],'utf8'),after=fs.readFileSync(process.argv[2],'utf8');if(!after.includes(' UI addition.') || after.replace(' UI addition.','')!==before)process.exit(1)" "$tmp/original.md" "$tmp/files/preview.md"
agent-browser --session "$session" find text 'long.md' click --exact >/dev/null
agent-browser --session "$session" wait --text 'Line 0' >/dev/null
agent-browser --session "$session" wait --fn "(() => { const container = document.querySelector('.document'); container.scrollTop = container.scrollHeight; return document.querySelector('.cm-table-editor code')?.innerText === 'end_code'; })()" --timeout 10000 >/dev/null
agent-browser --session "$session" click '.cm-table-toggle' >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-table-source')" >/dev/null
result=$(agent-browser --session "$session" eval "document.querySelector('#save').disabled")
[ "$result" = true ] || { echo 'Long table source reveal changed the document' >&2; exit 1; }
agent-browser --session "$session" find text 'bom.md' click --exact >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-frontmatter-toggle')" >/dev/null
result=$(agent-browser --session "$session" eval "!!document.querySelector('.cm-list-marker-source') && document.querySelector('#save').disabled")
[ "$result" = true ] || { echo 'BOM frontmatter list was not preserved as source' >&2; exit 1; }
echo 'Markdown inline code, lists, tables, properties, source preservation, and long documents passed.'
