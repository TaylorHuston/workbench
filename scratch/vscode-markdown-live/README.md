# Markdown Live Spike

> **Section:** Scratch
> **Status:** Experimental
> **Source:** Original VS Code extension using CodeMirror and codemirror-live-markdown, informed by the adjacent Markdown editor playground.

An opt-in custom text editor for exploring an Obsidian-like source-first live Markdown experience. Open a Markdown file and use **Reopen Editor With… → Markdown Live Spike**. It does not replace your default Markdown editor.

## Run

```sh
npm install
npm test
npm run build
code --extensionDevelopmentPath="$PWD"
```

In the Extension Development Host, open a **disposable copy** of a Markdown file and use **Reopen Editor With…**. Rebuild and restart the host after changes. Optionally run `sh test/theme-browser.sh`, `sh test/lists-browser.sh`, `sh test/tables-browser.sh`, and `sh test/mermaid-browser.sh` after building to check the UI in a browser; these require `agent-browser`. Do not test against irreplaceable notes.

## What to evaluate

- Inline Markdown rendering, revealing syntax at the cursor, and light/dark VS Code theme behavior.
- Tables render as read-only previews. Use their **MD** button to edit source. The upstream table parser splits unescaped pipes in wikilinks, so such tables can display incorrectly; direct cell editing is blocked because it could discard content. Table fidelity and line breaks remain unresolved.
- Undo/redo, edits in a split source editor, external changes, and rapid typing. The extension refuses conflicting writes and leaves unsent local text visible with copy/reopen instructions; it does not merge conflicts.
- Mermaid code blocks render locally as diagrams; use **Edit diagram source** to edit the original Markdown. Invalid diagrams show their source and a fallback message. Mermaid runs in strict security mode and does not enable diagram click actions. Reload the editor after changing the VS Code theme.
- Wikilink syntax is preserved as source, but navigation and Obsidian link resolution are not implemented.

## Boundaries

This is a prototype, not a production editor. The webview is not VS Code's native editor; native shortcuts, accessibility, Markdown/Obsidian syntax coverage and extension interoperability are not guaranteed. Newlines in a document must be consistently LF or CRLF; mixed newline documents are unsupported. No backend or storage outside VS Code's text document. No Obsidian plugin, Bases or Dataview support.
