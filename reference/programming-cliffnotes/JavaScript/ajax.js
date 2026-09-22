// Basic asynchronous HTTP example
// Run this from a local web server. Browser fetch() requests often fail when
// opening index.htm directly from the file system.

async function loadText() {
  try {
    const response = await fetch("simple.txt");

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const text = await response.text();
    console.log(text);
  } catch (error) {
    console.error("Could not load simple.txt", error);
  }
}

loadText();

// fetch() starts the request asynchronously, so the rest of the file keeps running.
console.log("I'm still running");

// XMLHttpRequest is the older API. You may still see it in legacy code, but fetch()
// is the standard choice for modern JavaScript.
