# Pi Workbench

> **Section:** Scratch
>
> **Status:** Experimental
>
> **Source:** Original local workbench spike, informed by the adjacent Markdown editor playground.

## Purpose

Browse and edit Markdown under `~/.pi` while exploring a potential Markdown-first agent workbench. This is a standalone local app, not a Pi extension or an Anthracite implementation.

## Run

```sh
npm install
npm run build
npm start
```

Open http://127.0.0.1:4175. The server binds only to loopback. `PORT` selects another port. To test on disposable files instead of real configuration, set `PI_WORKBENCH_ROOT` to an existing directory before starting. Use `npm test` for isolated filesystem and HTTP checks.

Choose a file, edit, and click **Save changes** or press Cmd/Ctrl+S. Changing files or leaving with unsaved changes prompts for confirmation. A save refuses to overwrite a file whose content changed since it was opened; copy your edits before reopening it. The appearance follows the system light/dark setting until you use **Dark mode**; your choice is saved in the browser.

Select the root, a folder, or a file in the tree to choose where actions apply. **New file** and **New folder** create inside the selected folder (or beside the selected file). New file names must end in `.md`. **Rename** changes the selected item's name without replacing an existing item. **Trash** asks for confirmation and uses macOS Trash; only empty folders can be trashed. Save or discard the open document before renaming or trashing it or an ancestor folder. macOS's `/usr/bin/trash` and `osascript` are required for trash and rename respectively.

## Boundaries

- All `.md` files, including those in hidden directories, are in scope. Non-Markdown files are not exposed. Directories appear even if they do not contain Markdown. Symbolic links are skipped pending a decision about following them.
- Files must be UTF-8 with consistent LF or CRLF line endings. Mixed and bare-CR line endings are refused rather than rewritten; CRLF is preserved on save.
- Writes are explicit, compare the last-read content, and preserve the file inode. Rename and Trash check the selected item's identity before acting. These checks are not atomic against other processes, and an interrupted write may damage the file. If a rename or Trash operation reports an uncertain failure, inspect both locations before retrying. Keep backups and do not use the spike for irreplaceable content. It is not a security sandbox against other local processes or filesystem races.
- The browser receives file contents. Do not expose the server, use untrusted browser extensions, or open it from an untrusted machine. Server checks reject cross-origin writes and non-loopback Host headers, but this is not an authenticated multi-user service.
- Uses CodeMirror and the alpha `codemirror-live-markdown` plugin. Rendering coverage is incomplete; the source remains the document. No separate Markdown preview/export, agent integration, or permission management is implemented.
- A one-off Storybook exception was approved for this spike; verify UI changes in a browser instead.

## Next step

Evaluate editing on disposable copies and explore which workbench and agent interactions are worth bringing to Anthracite.
