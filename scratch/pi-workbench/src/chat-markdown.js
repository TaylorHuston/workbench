import { marked } from 'marked';

// Decode character references in a detached textarea. Escaping '<' first makes
// the fragment text-only; the decoded value is always inserted with textContent.
function decodeText(text) {
  const decoder = document.createElement('textarea');
  decoder.innerHTML = String(text).replace(/</g, '&lt;');
  return decoder.value;
}
function safeLink(href) {
  try {
    const url = new URL(decodeText(href));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch { return null; }
}
function appendTokens(parent, tokens) {
  for (const token of tokens) {
    let node;
    switch (token.type) {
      case 'space': case 'def': continue;
      case 'text': case 'escape':
        if (token.tokens) appendTokens(parent, token.tokens);
        else parent.appendChild(document.createTextNode(decodeText(token.text)));
        continue;
      case 'html':
        parent.appendChild(document.createTextNode(token.raw)); continue;
      case 'image':
        // Never make a network request merely because a message contains an image.
        parent.appendChild(document.createTextNode(token.text || token.raw)); continue;
      case 'checkbox':
        node = document.createElement('input'); node.type = 'checkbox'; node.checked = !!token.checked; node.disabled = true; break;
      case 'br': node = document.createElement('br'); break;
      case 'hr': node = document.createElement('hr'); break;
      case 'heading': node = document.createElement(`h${token.depth}`); appendTokens(node, token.tokens); break;
      case 'paragraph': node = document.createElement('p'); appendTokens(node, token.tokens); break;
      case 'strong': case 'em': case 'del':
        node = document.createElement(token.type); appendTokens(node, token.tokens); break;
      case 'codespan': node = document.createElement('code'); node.textContent = token.text; break;
      case 'code': {
        node = document.createElement('pre'); const code = document.createElement('code'); code.textContent = token.text; node.append(code); break;
      }
      case 'blockquote': node = document.createElement('blockquote'); appendTokens(node, token.tokens); break;
      case 'link': {
        const href = safeLink(token.href);
        if (!href) { appendTokens(parent, token.tokens); continue; }
        node = document.createElement('a'); node.href = href; node.target = '_blank'; node.rel = 'noopener noreferrer';
        if (token.title) node.title = decodeText(token.title);
        appendTokens(node, token.tokens); break;
      }
      case 'list': {
        node = document.createElement(token.ordered ? 'ol' : 'ul');
        if (token.ordered && typeof token.start === 'number' && token.start !== 1) node.start = token.start;
        for (const item of token.items) { const li = document.createElement('li'); appendTokens(li, item.tokens); node.append(li); }
        break;
      }
      case 'table': {
        node = document.createElement('div'); node.className = 'chat-table';
        const table = document.createElement('table'), head = document.createElement('thead'), header = document.createElement('tr'), body = document.createElement('tbody');
        for (const cell of token.header) { const th = document.createElement('th'); if (cell.align) th.style.textAlign = cell.align; appendTokens(th, cell.tokens); header.append(th); }
        head.append(header); table.append(head);
        for (const cells of token.rows) { const tr = document.createElement('tr'); for (const cell of cells) { const td = document.createElement('td'); if (cell.align) td.style.textAlign = cell.align; appendTokens(td, cell.tokens); tr.append(td); } body.append(tr); }
        table.append(body); node.append(table); break;
      }
      default:
        // Unknown syntax remains visible rather than being silently dropped.
        parent.appendChild(document.createTextNode(token.raw ?? '')); continue;
    }
    parent.appendChild(node);
  }
}
export function renderChatMarkdown(element, text) {
  try {
    const fragment = document.createDocumentFragment();
    appendTokens(fragment, marked.lexer(text, { gfm: true }));
    element.replaceChildren(fragment);
  } catch {
    // A rendering failure must never erase a message from the interface.
    element.textContent = text;
  }
}
