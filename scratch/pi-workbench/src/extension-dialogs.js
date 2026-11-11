const $ = (selector) => document.querySelector(selector);
const modal = $('#extension-dialog'), form = $('#extension-dialog-form');
const title = $('#extension-dialog-title'), message = $('#extension-dialog-message'), status = $('#extension-dialog-status');
const field = $('#extension-dialog-field'), choice = $('#extension-dialog-choice'), editor = $('#extension-dialog-editor');
const cancel = $('#extension-dialog-cancel'), submit = $('#extension-dialog-submit');
const pending = new Map(); let current = null, sending = false;

function display() {
  if (current || !pending.size) return;
  current = pending.values().next().value; status.textContent = ''; sending = false;
  title.textContent = current.title || 'Extension request'; message.textContent = current.message || '';
  field.hidden = $('#extension-dialog-field-label').hidden = current.kind !== 'input';
  choice.hidden = $('#extension-dialog-choice-label').hidden = current.kind !== 'select';
  editor.hidden = $('#extension-dialog-editor-label').hidden = current.kind !== 'editor';
  field.value = ''; field.placeholder = current.placeholder || '';
  editor.value = current.prefill || ''; choice.replaceChildren();
  if (current.kind === 'select') {
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Select an option…'; placeholder.disabled = true; placeholder.selected = true; choice.append(placeholder);
    current.options.forEach((value, index) => { const option = document.createElement('option'); option.value = String(index + 1); option.textContent = value; choice.append(option); });
  }
  submit.textContent = current.kind === 'confirm' ? 'Confirm' : 'Continue'; cancel.disabled = submit.disabled = false;
  if (!modal.open) modal.showModal();
  (current.kind === 'input' ? field : current.kind === 'select' ? choice : current.kind === 'editor' ? editor : cancel).focus();
}
function closed(id) {
  pending.delete(id); if (current?.id !== id) return;
  current = null; sending = false; if (modal.open) modal.close(); display();
}
export function extensionDialogEvent(event) {
  if (event.type === 'extension_dialog') { pending.set(event.dialog.id, event.dialog); display(); }
  else if (event.type === 'extension_dialog_closed') closed(event.id);
}
export function extensionDialogsDisconnected() { pending.clear(); current = null; sending = false; if (modal.open) modal.close(); }
async function reply(value) {
  if (!current || sending) return;
  const id = current.id; sending = true; cancel.disabled = submit.disabled = true; status.textContent = '';
  try {
    const response = await fetch('/api/agent/dialog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, value }) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not send response');
    closed(id);
  } catch (error) {
    if (current?.id === id) { status.textContent = `${error.message}. Check the session before retrying.`; sending = false; cancel.disabled = submit.disabled = false; }
  }
}
form.addEventListener('submit', (event) => {
  event.preventDefault(); if (!current) return;
  let value;
  if (current.kind === 'confirm') value = true;
  else if (current.kind === 'select') { if (!choice.value) { status.textContent = 'Choose an option.'; return; } value = current.options[Number(choice.value) - 1]; }
  else value = current.kind === 'editor' ? editor.value : field.value;
  void reply(value);
});
cancel.addEventListener('click', () => void reply(null));
modal.addEventListener('cancel', (event) => { event.preventDefault(); void reply(null); });
