---
title: Field notebook
tags:
  - editor-lab
  - markdown
status: active
---

# Field notebook

This fixture tests **strong emphasis**, *quiet emphasis*, ~~deleted text~~, and `inline code` without leaving the writing surface.

> A good editor should make the document easier to read without making its source mysterious.

## Today’s checklist

- [x] Load a Markdown file
- [ ] Edit it in every candidate
  - Keep this nested item attached
  - Preserve the indentation
- [ ] Compare the serialized result

1. Choose an editor.
2. Change a sentence.
3. Inspect the source trace.

Visit [the CommonMark specification](https://commonmark.org/) or open [[editor-notes]] for the local comparison.

```ts
export const roundTrip = (source: string, output: string) => source === output
```

| Candidate | Native model | Expected fidelity |
| --- | --- | --- |
| CodeMirror | plain text | exact |
| Tiptap | document tree | normalized |
| MDXEditor | Lexical tree | MDX-aware |
