// Use JSON.stringify() to convert a JavaScript value into a JSON string.
// JSON is a string format, not a JavaScript object.
const user = { name: "Bob" };
const userJson = JSON.stringify(user);

console.log(typeof user); // object
console.log(typeof userJson); // string

// JSON requires double quotes around property names and string values.
// { name: 'Bob' } is valid JavaScript, but it is not valid JSON.
const jsonString = JSON.stringify({
  name: "Bob",
  born: 1990,
});
console.log(jsonString);

// Use JSON.parse() to convert a JSON string back into a JavaScript value.
const parsed = JSON.parse(jsonString);
console.log(parsed.born);

// JSON.parse() throws an error when the JSON string is malformed.
try {
  const validJson = JSON.parse('{ "name": "Bob" }');
  console.log(validJson.name);
} catch (error) {
  console.error("Invalid JSON", error);
}

// JSON supports strings, numbers, booleans, null, arrays, and objects.
// It does not preserve functions, undefined, Symbols, Maps, Sets, or Dates as-is.
const limitedJson = JSON.stringify({
  name: "Bob",
  age: undefined,
  greet() {
    console.log("Hi");
  },
});
console.log(limitedJson); // {"name":"Bob"}

// Dates become ISO strings. JSON.parse() does not convert them back to Date objects.
const dateJson = JSON.stringify({ createdAt: new Date() });
const parsedDate = JSON.parse(dateJson);
console.log(typeof parsedDate.createdAt); // string

// Pretty-print JSON for debugging by passing a spacing value as the third argument.
const prettyJson = JSON.stringify({ name: "Bob", born: 1990 }, null, 2);
console.log(prettyJson);

// JSON is commonly used with APIs. With fetch(), response.json() parses the body.
// const response = await fetch("/api/user");
// const data = await response.json();
