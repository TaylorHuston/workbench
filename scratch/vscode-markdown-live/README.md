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

In the Extension Development Host, open a **disposable copy** of a Markdown file and use **Reopen Editor With…**. Rebuild and restart the host after changes. Optionally run `sh test/theme-browser.sh`, `sh test/lists-browser.sh`, `sh test/tables-browser.sh`, `sh test/nonstandard-table-browser.sh`, `sh test/callouts-browser.sh`, `sh test/frontmatter-browser.sh`, `sh test/mermaid-browser.sh`, `sh test/wikilink-browser.sh`, and `sh test/wikilink-fragment-browser.sh` after building to check the UI in a browser; these require `agent-browser`. Do not test against irreplaceable notes.

## Local installation

For personal use without publishing to the Marketplace, build and install the VSIX:

```sh
npm install
npm run package:vsix
code --install-extension "$PWD/markdown-live-spike.vsix" --force
```

This installs `local.markdown-live-spike` in the default VS Code profile. Rebuild and reinstall after changes; local VSIX installations do not automatically track this repository. Reload VS Code if prompted. The editor remains opt-in under **Reopen Editor With…** and does not change the default Markdown editor. Packaging is for local use only; licensing and third-party notices need review before distributing the VSIX.

## What to evaluate

- Inline Markdown rendering, revealing syntax at the cursor, and light/dark VS Code theme behavior.
- Tables render as read-only previews; use the source button to edit Markdown. A basic fallback handles pipe tables with mismatched header/separator column counts, wikilink aliases and `<br>` line breaks without rewriting the file. Normal GFM tables still use the upstream parser, which can display unescaped wikilink pipes incorrectly; direct cell editing is blocked because it could discard content. Full table fidelity remains unresolved.
- Undo/redo, edits in a split source editor, external changes, and rapid typing. The extension refuses conflicting writes and leaves unsent local text visible with copy/reopen instructions; it does not merge conflicts.
- YAML frontmatter is expanded by default; **Hide properties** collapses it without changing the file. Collapse state is local to the editor view.
- Obsidian-style callouts render as highlighted blocks with their title; the source reappears on the active line. Foldable callouts are not yet collapsible.
- Mermaid code blocks render locally as diagrams; use **Edit diagram source** to edit the original Markdown. Invalid diagrams show their source and a fallback message. Mermaid runs in strict security mode and does not enable diagram click actions. Reload the editor after changing the VS Code theme.
- Cmd-click (macOS) or Ctrl-click an existing rendered wikilink to open its note in this editor. Resolution searches only the current local workspace folder: explicit relative paths, workspace paths, unique path suffixes and unique filenames are supported; duplicate names are not guessed. Edits must be acknowledged before navigation. `[[note|label]]`, `[[note#Heading]]`, `[[#Heading]]`, and block-ID links such as `[[note#^block-id]]` are supported. Missing or duplicate heading/block destinations are reported rather than guessed. Nested heading paths, note-property aliases, embeds, links inside table previews, remote workspaces and link creation/autocomplete are not supported. Resolution is not full Obsidian parity.

## Boundaries

This is a prototype, not a production editor. The webview is not VS Code's native editor; native shortcuts, accessibility, Markdown/Obsidian syntax coverage and extension interoperability are not guaranteed. Newlines in a document must be consistently LF or CRLF; mixed newline documents are unsupported. No backend or storage outside VS Code's text document. No Obsidian plugin, Bases or Dataview support.
