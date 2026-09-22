// Basic error handling

function squareRoot(value) {
  try {
    if (value === "") {
      throw new Error("Cannot square root an empty value.");
    }

    const number = Number(value);

    if (Number.isNaN(number)) {
      throw new Error("Cannot square root a non-number.");
    }

    if (number < 0) {
      throw new RangeError("Cannot square root a negative number with Math.sqrt().");
    }

    return `sqrt(${number}) = ${Math.sqrt(number)}`;
  } catch (error) {
    return error.message;
  }
}

function writeIt() {
  console.log(squareRoot("four"));
  console.log(squareRoot(""));
  console.log(squareRoot("4"));
  console.log(squareRoot("-4"));
}

writeIt();
