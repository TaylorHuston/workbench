// Run: node file-reading.js <sync|callback|promise|await> [filename]
// No Express needed: these are Node's built-in filesystem APIs.

const fs = require("node:fs");
const { readFile } = require("node:fs/promises");
const path = require("node:path");

const mode = process.argv[2];
// Resolve relative filenames beside this script, not the terminal's directory.
const filename = path.resolve(__dirname, process.argv[3] ?? "myfile.txt");

function reportError(error) {
  console.error("Read failed:", error.message);
  process.exitCode = 1;
}

// An async function ALWAYS returns a Promise.
// await unwraps the successful value, or throws if the Promise rejects.
async function readWithAwait() {
  console.log("1. Starting async read...");
  try {
    const pendingRead = readFile(filename, "utf8");
    const contents = await pendingRead; // Pauses THIS function, not the caller.
    console.log("3. File contents:", contents);
    console.log("4. Async function continues after await.");
  } catch (error) {
    reportError(error);
  }
}

switch (mode) {
  case "sync": {
    console.log("1. Starting synchronous read...");
    try {
      // Returns the actual string. JavaScript cannot continue until it does.
      const contents = fs.readFileSync(filename, "utf8");
      console.log("2. File contents:", contents);
      console.log("3. Caller continues after the blocking read.");
    } catch (error) {
      reportError(error);
    }
    break;
  }

  case "callback": {
    console.log("1. Starting async read...");
    // Supplies the result to a callback later; does not return the contents.
    fs.readFile(filename, "utf8", (error, contents) => {
      // Error-first convention: error is null on success.
      if (error) {
        reportError(error);
        return;
      }
      console.log("3. File contents:", contents);
    });
    console.log("2. Caller continues before the callback runs.");
    break;
  }

  case "promise": {
    console.log("1. Starting async read...");
    // Returns a Promise, NOT the file contents.
    const pendingRead = readFile(filename, "utf8");
    pendingRead
      .then((contents) => {
        // This callback receives the fulfilled value: the file's text.
        console.log("3. File contents:", contents);
      })
      .catch((error) => {
        reportError(error);
      });
    console.log("2. Caller continues before the then callback runs.");
    break;
  }

  case "await": {
    // Uses the SAME promise-returning readFile as the "promise" mode.
    readWithAwait();
    console.log("2. Caller continues while the async function waits.");
    break;
  }

  default:
    console.error("Usage: node file-reading.js <sync|callback|promise|await> [filename]");
    process.exitCode = 1;
}
