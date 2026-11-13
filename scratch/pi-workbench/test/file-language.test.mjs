import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EditorState } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import { fileLanguage, isMarkdown } from '../src/file-language.js';

test('selects language support by filename and keeps Markdown separate', () => {
  const samples = [
    ['a.ts', 'TypeScript', 'const value: number = 1'], ['a.tsx', 'TypeScript', 'const x = <div />'],
    ['a.js', 'JavaScript', 'const value = 1'], ['a.jsx', 'JavaScript', 'const x = <div />'],
    ['a.json', 'JSON', '{"value": 1}'], ['a.py', 'Python', 'def run():\n  return 1'],
    ['a.yml', 'YAML', 'value: 1'], ['a.html', 'HTML', '<h1>Hello</h1>'],
    ['a.css', 'CSS', 'body { color: red; }'], ['run.sh', 'Shell', 'echo hello'],
    ['.zshrc', 'Shell', 'echo hello'], ['LICENSE', 'Plain text', 'hello'], ['notes.unknown', 'Plain text', 'hello'],
  ];
  for (const [path, expected, content] of samples) {
    const language = fileLanguage(path); assert.equal(language.name, expected, path);
    const state = EditorState.create({ doc: content, extensions: [language.extension] });
    if (expected !== 'Plain text') assert.ok(ensureSyntaxTree(state, state.doc.length, 1000), path);
  }
  assert.equal(isMarkdown('docs/a.MD'), true); assert.equal(isMarkdown('docs/a.ts'), false);
});
