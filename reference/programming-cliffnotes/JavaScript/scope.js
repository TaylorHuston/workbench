const a = 4; // Module/global scope in this script; accessible by the functions below.

function foo() {
  const b = a * 3; // Function-scoped to foo(), but visible to nested functions.

  function bar(c) {
    const b = 2; // Shadows foo()'s b inside this function only.
    console.log(a, b, c);
  }

  bar(b * 4);
}

foo(); // 4, 2, 48

// let, const, and var
function run() {
  var foo = "Foo"; // var is function-scoped or globally-scoped.
  let bar = "Bar"; // let is block-scoped and can be reassigned.
  const qux = "Qux"; // const is block-scoped and cannot be reassigned.

  console.log(foo, bar, qux); // Foo Bar Qux

  {
    var moo = "Mooo";
    let baz = "Bazz";
    const zip = "Zip";
    console.log(moo, baz); // Mooo Bazz
    console.log(foo, bar, qux, zip); // Foo Bar Qux Zip
  }

  console.log(moo); // Mooo, because var is scoped to run()
  // console.log(baz); // ReferenceError: baz is block-scoped
  // console.log(zip); // ReferenceError: zip is block-scoped
}

// Closures
function makeCounter() {
  let count = 0;
  return function () {
    count += 1;
    return count;
  };
}

const counter1 = makeCounter();
const counter2 = makeCounter();

counter1(); // 1
counter1(); // 2

counter2(); // 1, separate closure memory

function makeGreeter(name) {
  return function () {
    console.log(`Hello, ${name}!`);
  };
}

const greeter1 = makeGreeter("Taylor");
const greeter2 = makeGreeter("Alex");

greeter1(); // "Hello, Taylor!"
greeter2(); // "Hello, Alex!"

run();
