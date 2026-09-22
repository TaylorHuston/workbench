// Functions

function functions() {
  // Function declarations are hoisted, so they can be called before they appear in the file.
  const x = makeANumber();
  console.log(x); // 72

  function makeANumber() {
    return 72;
  }

  const name = "Taylor";

  // Function expressions must be assigned before they are called.
  const sayHi = function (name) {
    console.log(`Nice to meet you ${name}`);
  };

  sayHi(name);

  // Standard local variable scope applies.
  const myScope = 10;

  function simpleFunction() {
    const myScope = 20;
    console.log(myScope); // 20
  }
  simpleFunction();
  console.log(myScope); // 10

  const adder = (x, y) => x + y;

  const z = adder(2, 3);
  console.log(z); // 5

  // Functions can return other functions and assign them.
  function multiplier(factor) {
    return function (number) {
      return number * factor;
    };
  }

  const twice = multiplier(2); // Returns a function that multiplies by 2.
  console.log(twice(5));

  // Call the returned function immediately.
  const third = multiplier(3)(5);
  console.log(third);

  // Standard recursion rules apply.
  function power(base, exponent) {
    if (exponent === 0) {
      return 1;
    }

    return base * power(base, exponent - 1);
  }
  console.log(power(2, 3)); // 8

  // Rest parameters are the modern way to accept any number of arguments.
  function someArgs(myBool, ...values) {
    const someBool = myBool;
    console.log(someBool);
    for (const value of values) {
      console.log(value);
    }
  }
  someArgs(true, 1, 2, 3);

  function sum(...numbers) {
    return numbers.reduce((total, number) => total + number, 0);
  }
  console.log(sum(1, 2, 3));

  // Passing functions to other functions is very powerful.
  const anotherArray = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  // In this example you can use any function in place of test to filter on any criteria.
  // Array.prototype.filter() already exists; this is just a manual implementation.
  function filter(array, test) {
    const passed = [];
    for (const item of array) {
      if (test(item)) {
        passed.push(item);
      }
    }
    return passed;
  }

  // Pass an anonymous function to filter, in this case one that tests for even numbers.
  console.log(
    filter(anotherArray, (number) => number % 2 === 0)
  );

  // apply() allows you to call a function and specify this, followed by an array of arguments.
  function speak(x, y) {
    console.log(`I am a ${this.type}, ${x} ${y}`);
  }

  const someObject = {
    type: "Human",
  };

  speak.apply(someObject, [10, 12]);

  // call() is similar, but takes arguments individually instead of as an array.
  speak.call(
    {
      type: "Cat",
    },
    "Hello",
    47
  );

  // Arrow functions are a concise syntax and do not have their own this context.
  const square = (x) => x * x;
  console.log(square(4)); // 16

  const person1 = {
    name: "Taylor",
    sayHi() {
      console.log("Hi, my name is", this.name);
    },
  };

  person1.sayHi(); // "Hi, my name is Taylor"

  const person2 = {
    name: "Taylor",
    sayHi: () => {
      console.log("Hi, my name is", this.name);
    },
  };

  person2.sayHi(); // "Hi, my name is undefined"
  // In this case, 'this' does not refer to the person object, but to the global context (or undefined in strict mode)
  // Arrow functions do not have their own 'this', they inherit it from the surrounding lexical scope
  // This means that if you use an arrow function inside a method, it will not have
  // access to the object it is defined in, which can lead to unexpected behavior.
}

functions();
