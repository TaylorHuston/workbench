function lieDetectorTest() {
  let lies = 0;

  let stolenDiamond = {};
  if (stolenDiamond) {  // Always true because an empty object is truthy
    console.log("You stole the diamond!");
    lies++;
  }

  let car = {
    keysInPocket: null,
  };
  if (car.keysInPocket) { // Always false because null is falsey
    console.log("You have the car keys in your pocket!"); // Doesn't print
    lies++;
  }
  if (car.emptyGasTank) { // Always false because undefined is falsey
    console.log("You drove the car after you stole it!");
    lies++;
  }

  let foundYouAtTheCrimeScene = []; // Always false because empty array is truthy but we haven't added any elements yet
  if (foundYouAtTheCrimeScene) { // Always true because an empty array is truthy
    console.log("A sure sign of guilt!");
    lies++;
  }
  if (foundYouAtTheCrimeScene[0]) { // Always false because the array is empty
    console.log("Caught red-handed!");
    lies++;
  }

  let yourName = " "; // Always true because a non-empty string is truthy
  if (yourName) {
    console.log("Guess you lied about your name");
    lies++;
  }

  return lies;
}

console.log(lieDetectorTest());