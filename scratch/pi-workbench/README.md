# Pi Workbench

> **Section:** Scratch
>
> **Status:** Experimental
>
> **Source:** Original local workbench spike, informed by the adjacent Markdown editor playground.

## Purpose

Browse and edit Markdown in a selected working directory and try a minimal Pi SDK session interface while exploring a potential Markdown-first agent workbench. This is a standalone local app, not a Pi extension or an Anthracite implementation.

## Run

```sh
npm install
npm run build
npm start
```

Open http://127.0.0.1:4175. The server binds only to loopback. `PORT` selects another port. `PI_WORKBENCH_ROOT` overrides the default file workspace only; it does not isolate Pi sessions or skills. Use an isolated `HOME` and `PI_CODING_AGENT_DIR` as well for disposable testing. Use `npm test` for isolated filesystem and HTTP checks.

Choose a workspace from the sidebar dropdown (`~/.pi` is the default), then choose a file, edit, and click **Save** in the document header or press Cmd/Ctrl+S. **Discard** confirms and restores the last loaded or saved editor snapshot without writing to disk; it does not reload external changes. Changing files or leaving with unsaved changes prompts for confirmation. A save refuses to overwrite a file whose content changed since it was opened; copy your edits before reopening it. The appearance follows the system light/dark setting until you use the sidebar theme icon; your choice is saved in the browser.

The sidebar has workspace and session pickers; the document and conversation are side by side. Selecting a session gives it a bookmarkable URL containing only a path-derived session key. Back and Forward switch sessions, subject to draft and run guards. Opening a session bookmark can start its configured global extensions. Existing workspace/file bookmarks remain supported, and file selection outside a session retains file URLs. IDs are not secrets and may appear in browser history, bookmarks, and sync. Bookmarks work only on this Workbench installation while the workspace and session remain available and unarchived.

Workbench associates each session with its last open document in **browser local storage**, not in the Pi session file. This is per browser profile and origin, not shared with other browsers or Pi clients; clearing browser storage loses those associations. A new session inherits the open document. If restoration fails or storage is unavailable, the editor reports it rather than silently choosing another file. Unsaved file drafts are not persisted; save or copy your work before leaving or refreshing. Switching sessions with document edits offers **Save**, **Discard**, or **Cancel**; a failed save keeps the editor and session in place. Workspace switches retain their discard confirmation. Clear unsent messages before switching.

Lists and tasks have source-first previews, and inline-code backticks reappear when the cursor enters the code. YAML frontmatter remains editable as text and can be collapsed with **Hide properties** without changing the file. Tables are read-only previews with inline-code styling: click a cell, **MD**, or **Edit table source** to edit the original Markdown. Clicking a cell opens the corresponding source row rather than editing the rendered cell; moving the cursor outside restores the preview. The irregular-table fallback handles some mismatched separators, wikilink aliases, and line breaks, but normal GFM table previews may still display unescaped wikilink pipes incorrectly. Direct table-cell editing is disabled because the upstream editor can lose content. Optional UI regression checks run with `sh test/markdown-browser.sh`, `sh test/route-browser.sh`, and `sh test/session-browser.sh` and require `agent-browser`; the scripts use isolated fixture servers and do not open real sessions.

Cmd/Ctrl-click a Markdown link or wikilink to follow it; ordinary clicks edit its source. HTTP(S) links open in a new tab. Local Markdown links resolve relative to the current file, and wikilinks resolve within the workspace only when unambiguous. Heading/block fragments, other URL schemes, non-Markdown targets and links outside the workspace are not supported. Wikilink lookup scans workspace directories and may be slow for large workspaces. Unsaved edits retain the normal discard confirmation.

Select the root, a folder, or a file in the tree to choose where **New file** and **New folder** create items. New file names must end in `.md`. Click the open document's filename to rename it (Enter confirms, Escape cancels); **Trash** moves the open file to macOS Trash after confirmation. Save or discard edits before renaming or trashing. The interface does not rename or trash folders. It is a generic Markdown editor and does not update Obsidian links on rename. macOS's `/usr/bin/trash` and `osascript` are required for trash and rename respectively.

## Agent session spike

The sidebar workspace dropdown selects the directory for both **Files** and **Sessions**. `~/.pi` is first and selected by default; other choices are only workspaces explicitly added in Workbench. Use **Add workspace** and an absolute path to register an existing folder and give it a name, even if it has no sessions. **Manage workspaces** renames, archives, or restores registrations. Archiving hides a workspace from the normal dropdown without changing its folder or sessions; the default workspace cannot be archived. Archiving the selected workspace first switches to the default, respecting the existing draft and run safeguards. If another client archives your selected workspace, it remains selected until you switch away.

Workbench stores these registrations under `~/.pi/agent/pi-workbench/workspaces/`, canonicalizes paths, and does not create the workspace directory, repositories, Git branches, or worktrees. Older path-only registrations remain readable and acquire name/archive fields when explicitly changed. Workspace metadata updates use per-record locks and revision checks; preserve stale locks or invalid/temporary metadata for inspection rather than automatically deleting them. A workspace is a working directory, not a sandbox. Existing Pi sessions appear after their working directory is added and selected.

The **Session** picker shows sessions for the selected directory from the standard `~/.pi/agent/sessions/` tree and the earlier Workbench spike's `~/.pi/agent/pi-workbench/sessions/`. Use **+** to start one; **Manage sessions** provides archive and restore. Opening a listed session reuses its catalog entry but checks the file and session identity again; refresh the session list to discover newly added sessions. Switching workspaces leaves an idle session open but hides it outside its workspace; opening another session replaces that runtime. Switching is blocked while a run is active or a message draft is present; unsaved document edits prompt to save, discard or cancel.

When sending a message, Workbench appends the current document's workspace-relative path to the user prompt as context; the path becomes part of the saved conversation. The agent can read the file using its normal tools, but Workbench does not send the document contents automatically. Save or discard editor changes before sending so the on-disk document is not mistaken for an unsaved buffer. The path is context, not an authorization boundary.

Starting a session opens an empty Pi runtime without calling a model. Like Pi, it writes the session JSONL only when the first message is sent. Until then, the empty session is shown only while it is open and disappears if closed or switched away from; the workspace registration remains. Sessions without a recorded working directory cannot be assigned to a workspace in this interface. A session whose directory is unavailable cannot be opened.

**Archive** hides a session in a collapsed Archived group; **Restore** returns it to the visible list. **Close session** instead closes the Workbench runtime without archiving or deleting the session. Archive state is Workbench-only metadata in `~/.pi/agent/pi-workbench/archived-sessions.json`, keyed by the session file path. Other Pi clients do not see this status; moving the file changes its key. Archiving never moves or changes the Pi session file and does not close or stop a running session. Metadata is serialized using an `archive-lock` in the same directory; if a lock is left after a crash or metadata is invalid, preserve and inspect it before recovery. Entries for missing sessions are retained, not automatically pruned.

The SDK uses Pi's configured model and credentials when a user sends a message. Sending may incur model costs. Workbench pins SDK version 1.5.2 rather than automatically following the installed Pi CLI. It discovers skills using Pi's user, configured package and project locations, advertising their descriptions in the system prompt; the agent reads full instructions when needed. Explicit `/skill:name` messages also work. Skills can instruct the agent to run scripts or modify files; discovery is not a sandbox.

Project skill discovery respects Pi's saved project-trust decisions and global default. Workbench cannot prompt for trust: if the default is `ask` and there is no saved decision, project skills are skipped and the session status says so. Grant trust through Pi separately if appropriate, then reopen the session. Trusted project settings are used for skill and package discovery only, not applied to the runtime. Only already-installed packages are considered; Workbench does not install missing packages.

Enabled **global extensions** load when a session opens, including extensions provided by installed global Pi packages. They execute with the user's permissions and can start processes, connect to services, or make model calls during loading, startup, reload, and shutdown. Project extensions remain disabled even in trusted projects, as do Pi's built-in MCP integration and prompt templates. A global extension can independently start MCP servers or connect to services; disabling built-in MCP does not prevent that. Workbench is not equivalent to the Pi CLI.

Workbench supports extension confirmation, selection, text input, and multiline editor dialogs, including requests made during session startup or reload. Dialogs honor extension cancellation signals and timeouts. Closing the last connected browser cancels pending requests; if multiple tabs are connected, the first valid response wins and later replies are rejected. Requests are not retained across server restarts. Notifications appear in session status. The dialog does not identify which extension requested it; inspect the request before responding.

Pi reports `ctx.hasUI` as true when the Workbench UI is bound. Custom terminal screens and other TUI-specific UI are not supported; custom screens fail instead of being silently accepted, while unsupported status, widget, and editor-customization APIs are no-ops. With no connected browser, confirmations are declined and input requests are cancelled. Extensions remain arbitrary code and may behave differently from the Pi CLI; do not assume extension dialogs or project trust form a sandbox. Extension load/start failures stop session opening. Runtime extension errors are reported and prevent further prompts until the session is reloaded or reopened, but an error does not guarantee an in-flight external action was prevented. Context files such as `AGENTS.md` still load. Pi's default tools may read or change files and execute commands with the user's permissions, without per-action approval. The interface currently renders user and assistant text plus transient tool status; it does not reproduce the full Pi transcript, thinking, attachments, or terminal UI.

One Workbench session can be open at a time. Use **Reload session** beside the open session's model to rediscover skills and context files and reload the same global extension paths without restarting the Workbench server. Reload preserves the conversation and any unsent draft, and is unavailable during a run. If the enabled extension selection changes, close and reopen the session instead. If runtime reload fails, further prompts are blocked until a successful reload or reopening. Opening another session closes the old extension runtime before loading the new one; if the new open fails, reopen the previous session. Reload does not update Workbench server code or enable project extensions or Pi's built-in MCP integration.

**Close a session in Pi CLI and other apps before opening it here:** Workbench cannot detect or prevent concurrent use by those programs and does not show a warning popup on each open. Opening a legacy session may cause Pi to upgrade its file format. Workbench uses a per-session lock within `~/.pi/agent/pi-workbench/locks/` to prevent two Workbench processes from opening the same session; it does not coordinate with other apps. After a crash a stale lock may require manual inspection and recovery; do not delete it blindly. Closing an active browser tab does not stop a running agent. Stop the run explicitly before closing or switching the session.

The local service is not authenticated against other local processes. Browser prompts and session contents are sensitive; use only on a trusted local machine. Tests use an isolated synthetic provider and do not contact a real model.

## Boundaries

- All `.md` files, including those in hidden directories, are in scope. Non-Markdown files are not exposed. Directories appear even if they do not contain Markdown. Symbolic links are skipped pending a decision about following them.
- Files must be UTF-8 with consistent LF or CRLF line endings. Mixed and bare-CR line endings are refused rather than rewritten; CRLF is preserved on save.
- Writes are explicit, compare the last-read content, and preserve the file inode. Rename and Trash check the selected item's identity before acting. These checks are not atomic against other processes, and an interrupted write may damage the file. If a rename or Trash operation reports an uncertain failure, inspect both locations before retrying. Keep backups and do not use the spike for irreplaceable content. It is not a security sandbox against other local processes or filesystem races.
- The browser receives file contents. Do not expose the server, use untrusted browser extensions, or open it from an untrusted machine. Server checks reject cross-origin writes and non-loopback Host headers, but this is not an authenticated multi-user service.
- Uses CodeMirror and the alpha `codemirror-live-markdown` plugin. Rendering coverage is incomplete; the source remains the document. The agent view is a restricted SDK spike, not full Pi CLI or extension UI parity. No separate Markdown preview/export or permission management is implemented.
- A one-off Storybook exception was approved for this spike; verify UI changes in a browser instead.

## Next step

Design cross-application session ownership before relying on concurrent use; separately evaluate model selection, extensions, and MCP.
