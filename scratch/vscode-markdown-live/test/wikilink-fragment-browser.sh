#!/bin/sh
# Optional browser regression: npm run build && sh test/wikilink-fragment-browser.sh
set -eu
cd "$(dirname "$0")/.."
session="markdown-live-fragment-$$"
trap 'agent-browser --session "$session" close >/dev/null 2>&1 || true' EXIT
agent-browser --session "$session" open "file://$PWD/test/wikilink-fragment-fixture.html" >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-content')" >/dev/null
agent-browser --session "$session" eval "window.postMessage({type:'jump-to-fragment',id:1,fragment:'Target heading'},'*'); true" >/dev/null
agent-browser --session "$session" wait --fn "window.outbound.some(m=>m.type==='jump-result'&&m.id===1)" >/dev/null
result=$(agent-browser --session "$session" eval "document.getSelection().anchorNode?.parentElement?.closest('.cm-line')?.textContent.includes('Target heading') && !window.outbound.some(m=>m.type==='edit')")
[ "$result" = true ] || { echo "Heading jump failed: $result" >&2; exit 1; }
agent-browser --session "$session" eval "window.postMessage({type:'jump-to-fragment',id:2,fragment:'^block-1'},'*'); true" >/dev/null
agent-browser --session "$session" wait --fn "window.outbound.some(m=>m.type==='jump-result'&&m.id===2)" >/dev/null
result=$(agent-browser --session "$session" eval "document.getSelection().anchorNode?.parentElement?.closest('.cm-line')?.textContent.includes('target block') && !window.outbound.some(m=>m.type==='edit')")
[ "$result" = true ] || { echo "Block jump failed: $result" >&2; exit 1; }
agent-browser --session "$session" eval "window.postMessage({type:'jump-to-fragment',id:3,fragment:'Decoy'},'*'); true" >/dev/null
agent-browser --session "$session" wait --fn "window.outbound.some(m=>m.type==='jump-result'&&m.id===3)" >/dev/null
result=$(agent-browser --session "$session" eval "document.querySelector('#status').textContent.includes('not found') && !window.outbound.some(m=>m.type==='edit')")
[ "$result" = true ] || { echo "Missing fragment fallback failed: $result" >&2; exit 1; }
agent-browser --session "$session" eval "window.outbound=[]; true" >/dev/null
agent-browser --session "$session" click '.cm-header-1' >/dev/null
agent-browser --session "$session" keyboard inserttext 'X' >/dev/null
agent-browser --session "$session" wait --fn "window.outbound.some(m=>m.type==='edit')" >/dev/null
agent-browser --session "$session" eval "window.postMessage({type:'jump-to-fragment',id:4,fragment:'Target heading'},'*'); true" >/dev/null
agent-browser --session "$session" wait 100 >/dev/null
result=$(agent-browser --session "$session" eval "!window.outbound.some(m=>m.type==='jump-result'&&m.id===4)")
[ "$result" = true ] || { echo "Jump did not wait for pending edits: $result" >&2; exit 1; }
agent-browser --session "$session" eval "window.postMessage({type:'ack',text:window.outbound.find(m=>m.type==='edit').text},'*'); true" >/dev/null
agent-browser --session "$session" wait --fn "window.outbound.some(m=>m.type==='jump-result'&&m.id===4)" >/dev/null
result=$(agent-browser --session "$session" eval "document.getSelection().anchorNode?.parentElement?.closest('.cm-line')?.textContent.includes('Target heading')")
[ "$result" = true ] || { echo "Pending jump did not resume: $result" >&2; exit 1; }
echo 'Heading and block jumps, missing fallback and source preservation passed.'
