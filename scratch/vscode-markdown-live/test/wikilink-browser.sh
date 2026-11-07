#!/bin/sh
# Optional browser regression: npm run build && sh test/wikilink-browser.sh
set -eu
cd "$(dirname "$0")/.."
session="markdown-live-wikilink-$$"
trap 'agent-browser --session "$session" close >/dev/null 2>&1 || true' EXIT
agent-browser --session "$session" open "file://$PWD/test/wikilink-fixture.html" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelectorAll('.cm-wikilink-widget').length === 4" >/dev/null
result=$(agent-browser --session "$session" eval --stdin <<'JS'
(() => {
  const links = [...document.querySelectorAll('.cm-wikilink-widget')]
  links[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  links[2].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, metaKey: true }))
  if (window.outbound.some(m => m.type === 'follow-wikilink')) return false
  links[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, metaKey: true }))
  links[0].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true }))
  const msg = window.outbound.find(m => m.type === 'follow-wikilink')
  return msg?.target === 'notes/topic' && msg.base === window.fixture && window.outbound.filter(m => m.type === 'follow-wikilink').length === 1 && !window.outbound.some(m => m.type === 'edit')
})()
JS
)
[ "$result" = true ] || { echo "Wikilink click regression failed: $result" >&2; exit 1; }
agent-browser --session "$session" click '.cm-wikilink-widget' >/dev/null
agent-browser --session "$session" wait --fn "!!document.querySelector('.cm-wikilink-source')" >/dev/null
result=$(agent-browser --session "$session" eval --stdin <<'JS'
(() => {
 window.outbound=[]
 const source=document.querySelector('.cm-wikilink-source')
 source.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,metaKey:true}))
 return window.outbound.some(m=>m.type==='follow-wikilink' && m.target==='notes/topic')
})()
JS
)
[ "$result" = true ] || { echo "Active wikilink source click failed: $result" >&2; exit 1; }
agent-browser --session "$session" eval "window.outbound=[]; true" >/dev/null
agent-browser --session "$session" click '.cm-header-1' >/dev/null
agent-browser --session "$session" keyboard inserttext 'X' >/dev/null
agent-browser --session "$session" wait --fn "window.outbound.some(m=>m.type==='edit')" >/dev/null
result=$(agent-browser --session "$session" eval --stdin <<'JS'
(() => {
 const link=[...document.querySelectorAll('.cm-wikilink-widget')].find(e=>e.textContent==='second')
 link.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,ctrlKey:true}))
 return !window.outbound.some(m=>m.type==='follow-wikilink')
})()
JS
)
[ "$result" = true ] || { echo "Navigation was not held for pending edit: $result" >&2; exit 1; }
agent-browser --session "$session" eval "window.postMessage({type:'ack',text:window.outbound.find(m=>m.type==='edit').text},'*'); true" >/dev/null
agent-browser --session "$session" wait --fn "window.outbound.some(m=>m.type==='follow-wikilink' && m.target==='second')" >/dev/null
result=$(agent-browser --session "$session" eval "window.outbound.find(m=>m.type==='follow-wikilink').base === window.outbound.find(m=>m.type==='edit').text")
[ "$result" = true ] || { echo "Navigation did not use acknowledged source: $result" >&2; exit 1; }
agent-browser --session "$session" eval "window.outbound=[]; window.postMessage({type:'conflict'},'*'); true" >/dev/null
agent-browser --session "$session" wait --fn "document.querySelector('#status').textContent.includes('changed elsewhere')" >/dev/null
result=$(agent-browser --session "$session" eval --stdin <<'JS'
(() => {
 const link=[...document.querySelectorAll('.cm-wikilink-widget')].find(e=>e.textContent==='second')
 link.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true,metaKey:true}))
 return !window.outbound.some(m=>m.type==='follow-wikilink')
})()
JS
)
[ "$result" = true ] || { echo "Navigation must stop on conflict: $result" >&2; exit 1; }
echo 'Wikilink modifiers, embed exclusion, edit acknowledgment and conflict guard passed.'
