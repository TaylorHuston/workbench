# Vanilla JavaScript Examples

This directory contains examples of core JavaScript programming concepts. Most files use vanilla JavaScript; `jq-stuff.js` is included as a legacy jQuery comparison because jQuery is still common in older projects.

## Running JavaScript Code

JavaScript can be run in several ways:

- **In a web browser**: Open `index.htm` from a local web server and use the browser's developer console
- **With Node.js**: Install Node.js and run files that do not depend on browser globals:  
  `node filename.js`
- **In browser console**: Copy and paste code directly into the browser's developer tools console
- **Online editors**: Use online JavaScript playgrounds like CodePen, JSFiddle, or Replit

Some examples depend on browser APIs such as `document`, `alert`, `prompt`, `fetch`, or jQuery. Those should be run in the browser rather than directly with Node.js.

To serve this directory locally:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.htm`.

## Directory Contents

### Core Concepts

- **variables.js** - Dynamic typing, `const`/`let`/`var`, operators, and number conversion
- **strings.js** - String manipulation, comparison, padding, trimming, and template literals
- **arrays.js** - Array creation, iteration, mutation, sorting, and higher-order methods
- **math.js** - Mathematical operations and Math object
- **date.js** - Date creation, timestamps, formatting, time zones, and mutation caveats
- **flow-control.js** - Conditional statements, strict equality, loops, and control flow
- **functions.js** - Function declarations, expressions, recursion, callbacks, rest parameters, and `this`
- **scope.js** - Variable scope, shadowing, closures, and `var`/`let`/`const`

### Object-Oriented Programming

- **basic-objects.js** - Object literals, properties, methods, getters/setters, and object identity
- **advanced-objects.js** - Prototypes, constructor functions, classes, private fields, and inheritance

### Input/Output and DOM

- **input-output.js** - Browser dialogs, console output, and click events
- **working-with-dom.js** - DOM querying, element creation, class updates, forms, and event handling
- **index.htm** - Browser launcher for the interactive examples

### Advanced Concepts

- **ajax.js** - Asynchronous HTTP with `fetch()`
- **json.js** - JSON strings, parsing, stringifying, limitations, and API usage
- **error-handling.js** - `try`/`catch`, `Error`, `RangeError`, and validation
- **timers.js** - `setTimeout`, `setInterval`, `clearTimeout`, and `clearInterval`
- **jq-stuff.js** - Legacy jQuery patterns for comparison with modern DOM APIs

### Supporting Files

- **simple.txt** - Text file for file reading examples
- **_images/** - Directory containing image files for examples

## Development Environment

### Browser Developer Tools

All modern browsers include developer tools with JavaScript consoles:

- **Chrome/Edge**: Press F12 or Ctrl+Shift+I
- **Firefox**: Press F12 or Ctrl+Shift+K
- **Safari**: Enable Developer menu, then press Cmd+Option+C

### Node.js Setup

To run JavaScript outside the browser:

```bash
# Verify installation
node --version
npm --version

# Run a JavaScript file
node filename.js
```

### Code Editors

Recommended editors for JavaScript development:

- **VS Code** - Free, with excellent JavaScript support
- **WebStorm** - Full-featured IDE
- **Sublime Text** - Lightweight editor with plugins

### Browser Compatibility

These examples use modern JavaScript features. For older browser support, consider:

- **Babel** - Transpiles modern JavaScript to older versions
- **Polyfills** - Add missing features to older browsers

## Learning Path

Recommended order for studying these examples:

1. **Start with basics**: variables.js → strings.js → arrays.js
2. **Core language flow**: flow-control.js → functions.js → scope.js
3. **Objects**: basic-objects.js → advanced-objects.js
4. **Built-in APIs**: math.js → date.js → json.js
5. **Browser interaction**: input-output.js → working-with-dom.js → timers.js → ajax.js
6. **Legacy comparison**: jq-stuff.js

## Testing Your Code

Use the browser console or Node.js to test code snippets. Use the browser for files that access the DOM or browser dialogs.

```javascript
// Example: Test in browser console
console.log("Hello, World!");

// Example: Test array methods
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
console.log(doubled); // [2, 4, 6, 8, 10]
```
