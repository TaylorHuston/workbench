// Conditionals and loops

function flowControl() {
  const age = 29;

  if (age > 30) {
    console.log("Damn you old");
  } else {
    console.log("Yung'in");
  }

  if (true && true) {
    console.log("true");
  }

  if (false || true) {
    console.log("true");
  }

  if (true && false) {
    console.log("false"); // Won't print
  }

  // Prefer strict equality. Loose equality coerces types before comparing.
  console.log(1 === 1); // true
  console.log(1 === "1"); // false
  console.log(1 !== 1); // false
  console.log(1 == "1"); // true, because loose equality coerces the string

  console.log(Boolean("")); // False
  console.log(Boolean("non-empty")); // True
  console.log(Boolean("false")); // True
  console.log(Boolean(0)); // False
  console.log(Boolean(3)); // True

  const score1 = 100;
  const score2 = 200;
  // Ternary: condition ? resultIfTrue : resultIfFalse
  const highScore = score1 > score2 ? score1 : score2;
  console.log(highScore); // 200

  // Loops
  for (let i = 0; i < 5; i++) {
    console.log(i);
  }

  // This loop prints odd numbers from 1 through 15.
  for (let i = 0; i < 5000; i++) {
    if (i % 2 === 0) {
      continue; // Move to next loop iteration
    }
    console.log(i);
    if (i === 15) {
      break; // End loop
    }
  }

  // This loop will print all numbers 1..10
  let x = 0;
  while (x < 10) {
    x++;
    console.log(x);
  }

  do {
    x--;
    console.log(x);
  } while (x > 0);

  // Switch statements compare cases with strict equality.
  const lunch = "Sammich";
  switch (lunch) {
    case "Sammich":
      console.log("Sammich, like a sandwich but with 10% more redneck.");
      break;
    case "Candy":
      console.log("Soup is for little kids. Eat a fatburger like an adult.");
      break;
    default:
      console.log("Not hungry?");
  }

  // Truthy and Falsey
  const truthyValues = ["non-empty string", 1, true, {}, []]; // Empty objects and arrays are truthy
  const falseyValues = ["", 0, null, undefined, false, NaN];

  for (const value of truthyValues) {
    if (value) {
      console.log(`${value} is truthy`);
    }
  }

  for (const value of falseyValues) {
    if (!value) {
      console.log(`${value} is falsey`);
    }
  }

}

flowControl();
