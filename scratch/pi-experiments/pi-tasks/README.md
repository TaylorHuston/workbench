# pi-tasks

- Section: scratch
- Status: experimental; not adopted
- Source: original Pi extension experiment.
- Purpose: exercise a provider-neutral task anchor and append-only JSONL working log through a headless Pi tool.

## Run checks

```sh
node --test store.test.mjs
```

## Try in Pi

Set `PI_TASKS_ROOT` to an existing absolute path in a disposable, private directory and launch Pi with `--extension /absolute/path/to/pi-tasks/index.ts`. The extension does not choose a default store and rejects roots resolving inside `.llm`; this is not a general filesystem sandbox. Do not point it at existing task data. The `pi_tasks` tool supports create, list, read, append, and update_state; a state update requires the exact content returned by read. Entries use Pi's full session ID. No UI, delete, automated hooks, or live data migration is implemented.

A disposable end-to-end test exercised create, append, read, list, and update_state through Pi; the task files and session attribution were checked afterward.

## Limits

This is a first-slice experiment, not a production writer. Use one writer only: compare-before-write does not protect against concurrent external edits, and interrupted state writes may be incomplete. JSONL appends have not been proven safe under concurrent writers or interruption; malformed entries are reported on read. Task Markdown and JSONL are independent; creation does not automatically write a day log. The current limitations are accepted for disposable experimentation; revisit them if a conflict occurs or before using real continuity records. The experiment does not change existing task skills or workspace continuity.
