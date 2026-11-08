# Node.js file reading

> **Section:** Reference
>
> **Status:** Complete
>
> **Source:** Original comparison based on the existing examples and the [Node.js filesystem documentation](https://nodejs.org/api/fs.html).

## Purpose

Compare four ways to read the same file: synchronous, callback-based, Promise chaining, and `async`/`await`.

## Context

`file-reading.js` combines the file-reading concepts in one runnable example. The original individual examples remain unchanged. The HTTP server and event-loop queue examples stay separate to keep this comparison focused.

## Running it

With Node.js installed, run from this directory:

```sh
node file-reading.js sync
node file-reading.js callback
node file-reading.js promise
node file-reading.js await
```

Each command runs only one mode so unrelated reads do not interleave. No dependencies or server are required. The default input is `myfile.txt` beside the script, even when launched from another working directory.

To see error handling without changing any files:

```sh
node file-reading.js promise does-not-exist.txt
node file-reading.js await does-not-exist.txt
```

All modes accept an optional filename and exit with a nonzero status on failure.

## Notes

| Mode | How you get the contents | Successful log order |
| --- | --- | --- |
| `sync` | Direct return value | Start, contents, caller continues |
| `callback` | Callback's second argument | Start, caller continues, contents |
| `promise` | Fulfilled value passed to `.then()` | Start, caller continues, contents |
| `await` | Value produced by `await` inside an async function | Start, caller continues, contents, async function continues |

- These are Node.js APIs, not Express features.
- `fs.readFile` and the `readFile` imported from `node:fs/promises` are different interfaces: one accepts a callback, the other returns a Promise.
- `.then()` handles fulfillment; `.catch()` handles rejection and errors thrown in the preceding handler.
- `async`/`await` still uses Promises. An async function returns a Promise even when you do not write `return`.
- `await` pauses only the surrounding async function. It does not block the whole program.
- A rejected Promise throws at `await`, so `try`/`catch` handles the error here. This example reports the failure and sets the process exit status rather than rethrowing.
- The numbers label execution order within each mode; on failure, the contents log is replaced by an error.

## Next step

Run the Promise and await modes side by side and identify where each receives the actual file contents. Keep this as a small reference rather than expanding it into a server.
