# Pi Workbench

> **Section:** Scratch
>
> **Status:** Experimental
>
> **Source:** Original local workbench spike, informed by the adjacent Markdown editor playground.

## Purpose

Browse and edit Markdown under `~/.pi` and try a minimal Pi SDK session interface while exploring a potential Markdown-first agent workbench. This is a standalone local app, not a Pi extension or an Anthracite implementation.

## Run

```sh
npm install
npm run build
npm start
```

Open http://127.0.0.1:4175. The server binds only to loopback. `PORT` selects another port. To test on disposable files instead of real configuration, set `PI_WORKBENCH_ROOT` to an existing directory before starting. Use `npm test` for isolated filesystem and HTTP checks.

Choose a file, edit, and click **Save** in the document header or press Cmd/Ctrl+S. **Discard** confirms and restores the last loaded or saved editor snapshot without writing to disk; it does not reload external changes. Changing files or leaving with unsaved changes prompts for confirmation. A save refuses to overwrite a file whose content changed since it was opened; copy your edits before reopening it. The appearance follows the system light/dark setting until you use the sidebar theme icon; your choice is saved in the browser.

Select the root, a folder, or a file in the tree to choose where actions apply. **New file** and **New folder** create inside the selected folder (or beside the selected file). New file names must end in `.md`. **Rename** changes the selected item's name without replacing an existing item. **Trash** asks for confirmation and uses macOS Trash; only empty folders can be trashed. Save or discard the open document before renaming or trashing it or an ancestor folder. macOS's `/usr/bin/trash` and `osascript` are required for trash and rename respectively.

## Agent session spike

The sidebar **Sessions** tab lists saved Pi sessions from the standard `~/.pi/agent/sessions/` tree, grouped by their recorded working directory. It also lists sessions made by the earlier Workbench spike under `~/.pi/agent/pi-workbench/sessions/`. Select one to open it in a new SDK runtime; Workbench does not create new sessions. Sessions without a recorded or available working directory are listed but cannot be opened.

**Archive** hides a session in a collapsed Archived group; **Restore** returns it to the visible list. **Close session** instead closes the Workbench runtime without archiving or deleting the session. Archive state is Workbench-only metadata in `~/.pi/agent/pi-workbench/archived-sessions.json`, keyed by the session file path. Other Pi clients do not see this status; moving the file changes its key. Archiving never moves or changes the Pi session file and does not close or stop a running session. Metadata is serialized using an `archive-lock` in the same directory; if a lock is left after a crash or metadata is invalid, preserve and inspect it before recovery. Entries for missing sessions are retained, not automatically pruned.

The SDK uses Pi's configured model and credentials when a user sends a message. Sending may incur model costs. Workbench pins SDK version 1.5.2 rather than automatically following the installed Pi CLI. It discovers skills using Pi's user, configured package and project locations, advertising their descriptions in the system prompt; the agent reads full instructions when needed. Explicit `/skill:name` messages also work. Skills can instruct the agent to run scripts or modify files; discovery is not a sandbox.

Project skill discovery respects Pi's saved project-trust decisions and global default. Workbench cannot prompt for trust: if the default is `ask` and there is no saved decision, project skills are skipped and the session status says so. Grant trust through Pi separately if appropriate, then reopen the session. Trusted project settings are used for skill and package discovery only, not applied to the runtime. Only already-installed packages are considered; Workbench does not install missing packages. Extensions, prompt templates, MCP, and other project-local Pi settings remain disabled; the session is not equivalent to a normal Pi CLI loadout. Context files such as `AGENTS.md` still load. Pi's default tools may read or change files and execute commands with the user's permissions, without per-action approval. A working directory is not a sandbox. The interface currently renders user and assistant text plus transient tool status; it does not reproduce the full Pi transcript, thinking, attachments, or extension UI.

One Workbench session can be open at a time. Use **Reload session** beside the open session's model to rediscover skills, context files, and applicable settings without restarting the Workbench server. Reload preserves the conversation and any unsent draft, and is unavailable during a run. If reload fails, the runtime may be partially reloaded; close and reopen the session if needed. Reload does not update Workbench server code or enable extensions or MCP.

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
