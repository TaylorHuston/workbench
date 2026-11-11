# pi-tasks

- Section: scratch
- Status: experimental; not adopted
- Source: original Pi extension experiment.
- Purpose: exercise provider-neutral task anchors and append-only task/day JSONL logs through headless Pi tools.

## Run checks

```sh
node --test store.test.mjs
```

## Try in Pi

Set `PI_TASKS_ROOT` to an existing absolute path in a disposable, private directory and launch Pi with `--extension /absolute/path/to/pi-tasks/index.ts`. The default extension does not choose a store; a host may instead use the exported `createTaskExtension(absoluteRoot)` factory for an explicitly configured store. The store rejects roots resolving inside `.llm`; this is not a general filesystem sandbox. Do not point it at existing task data. The task tools are `task_create`, `task_read`, `task_list`, `task_append`, `task_update_state`, and `task_close`; state updates and closure require the exact anchor content returned by `task_read`. `task_close` records a done/dropped conclusion in the anchor and appends a minimal `task_close` day entry. The previous combined `pi_tasks` tool is no longer registered. `day_open` reads a specified local date or today without creating a missing log; `day_append` appends an attributed entry to the current local day. Entries use Pi's full session ID and receive a generated UUID v4. Creating a task also appends a `task_open` day entry. No UI, delete, automated hooks, task reopen, or live data migration is implemented.

A disposable end-to-end test exercised create, append, read, list, and update_state through Pi; the task files and session attribution were checked afterward.

## Limits

This is an experiment, not a production writer. Use one writer only: compare-before-write does not protect against concurrent external edits, and interrupted state writes may be incomplete. JSONL appends have not been proven safe under concurrent writers or interruption; malformed entries are reported on read. A writer checks UUID v4 uniqueness within the destination log before appending; this is not an atomic cross-process or cross-log guarantee. Earlier experimental entries without IDs remain readable and are not backfilled. If an existing log has malformed JSON, duplicate IDs, invalid IDs, or a missing final newline, the writer refuses to append. Creating or closing a task and appending its day entry are separate writes. If the day append fails, the created or closed task is retained and the tool reports an uncertain outcome: inspect the day before manually appending, and do not recreate/reopen the task or retry blindly. Closing rejects an existing conclusion instead of overwriting it. The current limitations are accepted for disposable experimentation; revisit them if a conflict occurs or before using real continuity records. The experiment does not change existing task skills or workspace continuity.
