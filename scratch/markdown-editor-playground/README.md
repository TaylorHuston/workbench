# Markdown Editor Playground

> **Section:** Scratch
>
> **Status:** Active
>
> **Source:** Original comparison experiment using the editors' official React packages and documentation

## Purpose

Compare six browser-based writing engines against the same tracked Markdown and MDX fixtures in one live environment:

- CodeMirror 6 with `codemirror-live-markdown`
- Tiptap
- Milkdown Crepe
- Lexical
- BlockNote
- MDXEditor

The playground keeps each integration isolated behind a small adapter, mounts only the selected editor, and displays the current serialized output beside the writing surface. Exact-source status and byte delta make normalization or lossy conversion visible rather than treating every editor as interchangeable.

## Context

This experiment supports editor selection for Markdown-oriented applications such as AnthraciteMD and 49th Floor. It is intentionally a client-only comparison rather than a reusable editor package or production application.

Fixtures live under `src/content/`, including nested Markdown and an MDX document with JSX. Vite imports them as raw tracked source files.

## Running it

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Use these checks after changes:

```bash
npm run lint
npm run build
```

## Notes

- Only CodeMirror is expected to preserve arbitrary Markdown byte-for-byte.
- The CodeMirror adapter includes small compatibility layers for the current alpha of `codemirror-live-markdown`: list previews insert bullets, task boxes, and ordered markers; grouped inline preview reveals both delimiters when the cursor is inside formatted content; blockquote decoration adds the visual structure missing from the package default.
- CodeMirror fenced blocks use the package's `codeBlockField` and Lowlight integration for highlighted preview, source-on-focus behavior, and copying.
- The Tiptap adapter adds a custom Markdown frontmatter node plus Tiptap's task-list, table, and Lowlight code-block extensions. That compatibility work counts toward its implementation-complexity score. Table support and the limited JavaScript/TypeScript highlighter raise its lazy chunk to roughly 206 kB minified (69 kB gzip).
- The Milkdown adapter enables Crepe's opt-in top bar so the current block can switch between paragraph and heading levels and exposes its formatting, list, insert, and block actions. A small guard prevents those actions from replacing the custom Properties node.
- The Milkdown adapter adds `remark-frontmatter` and a matching custom ProseMirror node so YAML properties remain one editable block and serialize as frontmatter. This also counts as compatibility work rather than native Crepe behavior.
- The BlockNote and MDXEditor adapters keep YAML in a shared raw Properties panel, pass only the body into their structured editors, and rejoin both parts on export. This prevents BlockNote from misparsing frontmatter and avoids MDXEditor's scalar property dialog flattening YAML arrays such as `tags`. MDXEditor also maps HTML comments to a private JSX comment node while editing because HTML comment syntax is invalid MDX, then restores the original comment syntax on export.
- The five structured-editor adapters translate `[[wikilinks]]` and `[[target|labels]]` to inert internal-link sentinels while editing, then restore the wiki syntax on export. This shared compatibility layer provides a link affordance without modifying frontmatter or code examples; actual note navigation still requires an application resolver.
- Tiptap, Milkdown, Lexical, BlockNote, and MDXEditor edit structured document models and may normalize or discard unsupported syntax during serialization.
- BlockNote's Markdown conversion is explicitly lossy.
- MDXEditor carries its own Lexical dependency; its adapter remains isolated from the standalone Lexical comparison.
- Vite reports large production chunks for CodeMirror (after enabling the package's bundled Lowlight code-block preview), BlockNote, Milkdown, and MDXEditor. Lazy adapters keep them separate, but bundle weight remains an explicit evaluation item.
- Dependencies retain their own licenses. In particular, the open-source BlockNote packages used here are MPL-2.0; no BlockNote XL package is included.
- There is no backend, remote content, or durable storage. Reset reloads the selected fixture from source.

## Next step

Use the playground to record hands-on findings for source fidelity, editing feel, keyboard behavior, unsupported constructs, performance, and implementation effort. Keep it in `scratch/` unless a single editor integration is deliberately reduced into a canonical reference.
