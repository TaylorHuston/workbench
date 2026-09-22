// Basic Math examples

function math() {
  console.log(Math.PI);
  console.log(Math.E);

  console.log(Math.round(3.14)); // 3, nearest integer
  console.log(Math.ceil(3.14)); // 4, rounds up
  console.log(Math.floor(3.14)); // 3, rounds down
  console.log(Math.trunc(3.14)); // 3, removes the decimal part

  console.log(Math.abs(-3.14)); // 3.14
  console.log(Math.min(1, 2, 3, 4, 5)); // 1
  console.log(Math.max(1, 2, 3, 4, 5)); // 5
  console.log(Math.pow(2, 3)); // 8
  console.log(2 ** 3); // 8, modern exponentiation operator
  console.log(Math.sqrt(16)); // 4

  // Math.random() returns a number from 0 up to, but not including, 1.
  console.log(Math.random());

  // Random integer from min through max, inclusive.
  const min = 1;
  const max = 6;
  const randomDieRoll = Math.floor(Math.random() * (max - min + 1)) + min;
  console.log(randomDieRoll);

  // JavaScript numbers are floating-point values, so decimal math can be imprecise.
  console.log(0.1 + 0.2); // 0.30000000000000004
  console.log(Number.isInteger(3)); // true
  console.log(Number.isFinite(10 / 2)); // true
}

math();
