// Array syntax

function arrays() {
  // Creating an array with the array literal syntax
  const foo = [];

  // Creating an array with the array literal syntax
  let bar = [1, "a", 3.5, true, 2]; // Not type specific

  // The Array constructor can create sparse arrays with empty slots.
  const sparse = new Array(100);
  console.log(sparse.length); // 100
  console.log(sparse[0]); // undefined, but the slot is empty

  // "Old school" way to loop through an array
  for (let i = 0; i < bar.length; i++) {
    console.log(bar[i]);
  }

  // Newer way to loop through an array
  for (let element of bar) {
    console.log(element);
  }

  console.log(foo.length); // 0
  console.log(bar.length); // 5
  console.log(foo[0]); // undefined
  if (foo[0] === undefined) { // You can actually check for undefined
    console.log("foo[0] is undefined");
  }
  foo[0] = "a";
  console.log(foo[0]); // a

  console.log(bar[0]); // 1

  // Push adds to end
  foo.push("z");
  console.log(foo[0]); // a
  console.log(foo.length); // 101
  console.log(foo[100]); // z

  // Pop removes from end
  console.log(foo.pop()); // z
  console.log(foo.length); // 1

  // Shift removes from front
  console.log(bar.shift()); // 1
  // Add to front
  bar.unshift("x");
  console.log(bar[0]); // x

  const fub = [];
  console.log(fub.length);

  fub[4] = 4;
  console.log(fub.length); // 5
  console.log(fub[0]); // undefined

  let rand = [1, 5, 3, 9, 8, 3];

  console.log(rand); // [1, 5, 3, 9, 8, 3]
  rand.reverse(); // Reverse the array in place
  console.log(rand); // [3, 8, 9, 5, 3, 1]
  rand.sort(); // Sorts the array in place, but sorts as strings by default
  console.log(rand); // [1, 3, 3, 5, 8, 9]

  const sortExample = [1, 10, 2, 21];
  console.log(sortExample.toSorted()); // [1, 10, 2, 21], string-based order
  console.log(sortExample.toSorted((a, b) => a - b)); // [1, 2, 10, 21]

  // Slice returns a new array with elements from start to end (not including end)
  console.log(rand.slice(1, 4)); // [3, 3, 5]
  console.log(rand.slice(1)); // [3, 3, 5, 8, 9] - from index 1 to end
  console.log(rand.slice(-3)); // [5, 8, 9] - from the end
  console.log(rand.splice(1, 3)); // [3, 3, 5] - removes 3 elements starting at index 1 and returns them
  console.log(rand); // [1, 8, 9] - original array modified
  rand.splice(1, 0, 2, 4); // Inserts 2 and 4 at index 1 without removing any elements
  console.log(rand); // [1, 2, 4, 8, 9] - original array modified

  // Some array methods mutate the original array; others return a new array.
  console.log(rand.toReversed()); // [9, 8, 4, 2, 1] - new array
  console.log(rand); // [1, 2, 4, 8, 9] - original array unchanged
  console.log(rand.toSpliced(1, 2)); // [1, 8, 9] - new array

  let sum = 0;
  rand.forEach(function (someVal) {
    console.log(someVal);
    sum += someVal;
  });
  console.log(sum);

  // Use filter to exclude certain elements
  console.log(
    rand.filter((val) => val % 2 === 0)
  );

  // Use map to apply a function to each element of an array and build a NEW array from the results
  console.log(
    rand.map((val) => val * 2)
  );

  // Reduce returns a single value based on a function ran on each array element in order. Internal logic looks something like
  // function reduce(array, combine, start) {
  //   var current = start;
  //   for (var i = 0; i < array.length; i++)
  //     current = combine(current, array[i]);
  //   return current;
  // }

  // Use reduce to combine all elements
  console.log(
    rand.reduce((sum, val) => sum + val, 0)
  );

  // Use reduce to find smallest element
  console.log(
    rand.reduce((smallest, val) => (smallest < val ? smallest : val))
  );

  // 2D array
  let twoD = [
    [1, 2],
    [3, 4],
  ];

  console.log(twoD[0][0]); // 1
  console.log(twoD[1][1]); // 4

  // Destructuring pulls values out of an array by position.
  const colors = ["red", "green", "blue"];
  const [firstColor, secondColor] = colors;
  console.log(firstColor); // red
  console.log(secondColor); // green

  // You can skip positions with an extra comma.
  const [, , thirdColor] = colors;
  console.log(thirdColor); // blue

  // Rest syntax collects the remaining values into a new array.
  const [favoriteColor, ...otherColors] = colors;
  console.log(favoriteColor); // red
  console.log(otherColors); // ["green", "blue"]

  // Spread syntax expands an array into another array.
  const numbers = [1, 2, 3];
  const moreNumbers = [4, 5];
  const numbersCopy = [...numbers];
  const combinedNumbers = [...numbers, ...moreNumbers];
  console.log(numbersCopy); // [1, 2, 3]
  console.log(combinedNumbers); // [1, 2, 3, 4, 5]

  // Spread makes a shallow copy. Nested objects are still shared.
  const nested = [{ name: "Taylor" }];
  const nestedCopy = [...nested];
  nestedCopy[0].name = "Alex";
  console.log(nested[0].name); // Alex

  // Join converts array into string with a separator
  console.log(rand.join(" and ")); // 1 and 2 and 4 and 8 and 9
}

arrays();
