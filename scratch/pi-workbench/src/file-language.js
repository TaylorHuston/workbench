import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { python } from '@codemirror/lang-python';
import { yaml } from '@codemirror/lang-yaml';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { HighlightStyle, StreamLanguage } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { shell } from '@codemirror/legacy-modes/mode/shell';

export const codeHighlight = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.controlKeyword, tags.operatorKeyword], color: 'var(--code-keyword)' },
  { tag: [tags.variableName, tags.propertyName, tags.function(tags.variableName)], color: 'var(--code-name)' },
  { tag: [tags.typeName, tags.className, tags.tagName], color: 'var(--code-type)' },
  { tag: [tags.string, tags.regexp, tags.special(tags.string)], color: 'var(--code-string)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--code-number)' },
  { tag: [tags.comment, tags.meta], color: 'var(--code-comment)' },
]);
export const isMarkdown = (path) => /\.md$/i.test(path);
export function fileLanguage(path) {
  const name = path.split('/').at(-1).toLowerCase();
  if (/\.(?:ts|mts|cts|tsx)$/.test(name)) return { name: 'TypeScript', extension: javascript({ typescript: true, jsx: name.endsWith('.tsx') }) };
  if (/\.(?:js|mjs|cjs|jsx)$/.test(name)) return { name: 'JavaScript', extension: javascript({ jsx: name.endsWith('.jsx') }) };
  if (/\.jsonc?$/.test(name)) return { name: 'JSON', extension: json() };
  if (/\.(?:py|pyi)$/.test(name)) return { name: 'Python', extension: python() };
  if (/\.ya?ml$/.test(name)) return { name: 'YAML', extension: yaml() };
  if (/\.html?$/.test(name)) return { name: 'HTML', extension: html() };
  if (/\.css$/.test(name)) return { name: 'CSS', extension: css() };
  if (/\.(?:sh|bash|zsh)$/.test(name) || ['.bashrc', '.bash_profile', '.zshrc', '.zprofile'].includes(name)) return { name: 'Shell', extension: StreamLanguage.define(shell) };
  return { name: 'Plain text', extension: [] };
}
