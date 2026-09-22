// Basic examples of JavaScript values, variables, and operators

function variables() {
  // JavaScript is dynamically typed: a variable can hold different value types over time.
  let a = "I am a string";
  let b = 100;
  const c = 100.1;
  const d = true;
  const e = `${a} ${b}`; // String interpolation
  console.log(a);
  console.log(b);
  console.log(c);
  console.log(d);
  console.log(e);

  console.log(typeof a); // string
  console.log(typeof b); // number
  console.log(typeof c); // number
  console.log(typeof d); // boolean
  console.log(typeof e); // string

  // Change type by assigning a different kind of value.
  b = a;

  console.log(b); // I am a string

  // Random value between 0 and 1, not including 1.
  const ran = Math.random();
  console.log(ran);

  let x = 1;

  x += 1;
  console.log(x); // 2

  x += 10;
  console.log(x); // 12

  x %= 7; // Remainder
  console.log(x); // 5

  x *= 10;
  console.log(x); // 50
  console.log(x++); // 50. Logs x first, then increments
  console.log(++x); // 52. Increments, then logs

  // Math has many utility functions.
  x = 215.67;
  const y = Math.round(x);
  const z = Math.floor(x);
  console.log(x); // 215.67
  console.log(y); // 216
  console.log(z); // 215

  const aString = "55"; // String
  console.log(Number.isNaN(aString)); // false; the string value itself is not the number NaN
  console.log(isNaN(aString)); // false; global isNaN() coerces "55" to 55 first
  const aNumber = Number(aString); // Convert to number
  console.log(Number.isNaN(aNumber)); // false

  const badNumber = Number("hello");
  console.log(Number.isNaN(badNumber)); // true

  console.log(Math.PI); // BRING ME SOME PIE

  const name = "John";
  console.log("Hello".concat(" ", name, "!")); // Using concat to join strings
  console.log(`Hello ${name}!`); // Using template literals to join strings
  console.log("Hello " + name + "!"); // Using + to join strings

  if (true) {
    let x = 10; // Block-scoped variable, won't interfere with the x outside the block
    console.log(x); // 10
    var f = 20; // Function-scoped variable, considered legacy, not really used anymore
  }

  console.log(x); // 215.67, the outer x is still in scope
  console.log(f); // 20, because var is function-scoped, not block-scoped

  var g = 1;
  var g = 2; // No error, var can be redeclared

  const h = 1;
  // const h = 2; // SyntaxError: Identifier 'h' has already been declared
  console.log(h);

  const FOO = "foo";
  const foo = "bar"; // Different from FOO, case-sensitive
  console.log(FOO, foo);

  // Prefer const unless you need to reassign the variable.
  const i = 1;
  // i = 2; // TypeError: Assignment to constant variable.

  
  // You can check for undefined
  let q;
  if (q == undefined) {
    console.log("q is undefined");
    console.log(typeof q);
  }

  // null is essentially the same as undefined, but common practice is to use null for objects, undefined for simple variables
  if (q == null) {
    console.log("q is null");
    console.log(typeof q);
  }

  // NaN (Not-a-Number), though it's actually closer to "a number that cannot be represented"
  let r = 0/0
  if (Number.isNaN(r)) {
    console.log("r is NaN");
    console.log(typeof r);
  }

  // JS is smart enough to coerce types in certain comparisons
  let stringNum = "99";
  if (stringNum == 99) {
    console.log("stringNum is equal to 99 with type coercion");
  }

  if (1 == true) {
    console.log("1 is equal to true with type coercion");
  }

  if (0 == false) {
    console.log("0 is equal to false with type coercion");
  }

  if (undefined == null) {
    console.log("undefined is equal to null with type coercion");
  }

  // Strict equality checks without type coercion
  if (45 === "45") {
    // This won't run
  } else {
    console.log("45 is not strictly equal to '45'");
  }

  console.log("3" + 4); // "34", string concatenation due to type coercion  
  console.log(3 + "4"); // "34", string concatenation due to type coercion
  console.log(3 + Number("4")); // 7, string is coerced to number for addition
  console.log("3" * 4); // 12, string is coerced to number for multiplication
  console.log("3" - 1); // 2, string is coerced to number for subtraction
  console.log("3" / 1); // 3, string is coerced to number for division
  console.log("3" % 2); // 1, string is coerced to number for modulus
  console.log(1+2+" pizzas"); // "3 pizzas", number is coerced to string for concatenation
  console.log("pizzas: " + 1 + 2); // "pizzas: 12", string concatenation due to type coercion


}

variables();
