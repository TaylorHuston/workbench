// Demonstrates asynchronous file reading in Node.js using fs.readFile

const fs = require("fs");

console.log("1. Starting async read...");
fs.readFile("myfile.txt", "utf8", (err, data) => {
  if (err) throw err;
  console.log("2. File contents:", data);
});

console.log("3. Done starting read operation");
