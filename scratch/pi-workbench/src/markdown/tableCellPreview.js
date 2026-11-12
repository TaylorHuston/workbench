import { ViewPlugin } from '@codemirror/view';

function escaped(text, pos) {
  let count = 0; while (pos > 0 && text[--pos] === '\\') count++;
  return count % 2 === 1;
}
function appendPlain(parent, value, fallback) {
  const text = fallback ? value.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\\\|/g, '|') : value;
  const parts = fallback ? text.split(/<br\s*\/?\s*>/i) : [text];
  parts.forEach((part, index) => { if (index) parent.appendChild(document.createElement('br')); parent.appendChild(document.createTextNode(part)); });
}
function delimiter(text) {
  const mark = document.createElement('span'); mark.hidden = true; mark.setAttribute('aria-hidden', 'true'); mark.textContent = text; return mark;
}

// DOM nodes only: never interpret note content as HTML. Keep raw backticks in
// textContent so the upstream widget's blur handler cannot mistake a preview for an edit.
export function appendTableCellContent(parent, source, { fallback = false } = {}) {
  let textStart = 0, i = 0, found = false;
  while (i < source.length) {
    if (source[i] !== '`' || escaped(source, i)) { i++; continue; }
    let length = 1; while (source[i + length] === '`') length++;
    let end = i + length;
    while (end < source.length) {
      if (source[end] !== '`' || escaped(source, end)) { end++; continue; }
      let run = 1; while (source[end + run] === '`') run++;
      if (run === length) break;
      end += run;
    }
    if (end >= source.length) { i += length; continue; }
    appendPlain(parent, source.slice(textStart, i), fallback);
    const code = document.createElement('code'); code.className = 'cm-table-inline-code';
    const content = source.slice(i + length, end);
    code.append(delimiter(source.slice(i, i + length)), document.createTextNode(fallback ? content.replace(/\\\|/g, '|') : content), delimiter(source.slice(end, end + length)));
    parent.appendChild(code); found = true; i = end + length; textStart = i;
  }
  appendPlain(parent, source.slice(textStart), fallback);
  return found;
}

// The upstream table editor emits plain text contenteditable cells. Mark them
// read-only and decorate their existing DOM without changing their textContent.
export const tableCellPreview = ViewPlugin.fromClass(class {
  constructor(view) {
    this.view = view; this.destroyed = false;
    this.observer = new MutationObserver(() => this.render());
    this.observer.observe(view.dom, { childList: true, subtree: true });
    queueMicrotask(() => this.render());
  }
  render() {
    if (this.destroyed) return;
    for (const cell of this.view.dom.querySelectorAll('.cm-table-editor .cm-table-cell')) {
      if (cell.dataset.workbenchTableCell) continue;
      cell.dataset.workbenchTableCell = 'true'; cell.contentEditable = 'false';
      const fragment = document.createDocumentFragment();
      if (appendTableCellContent(fragment, cell.textContent)) cell.replaceChildren(fragment);
    }
  }
  destroy() { this.destroyed = true; this.observer.disconnect(); }
});
