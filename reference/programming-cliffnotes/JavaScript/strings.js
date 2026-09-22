// Basic string functions

function strings() {
  const s = "Supercalifragilisticexpialidocious";
  console.log(s);
  console.log(s.length); // 34

  const formatted = "Quoth the raven:\n\t\"Nevermore!\"";
  console.log(formatted);

  // Strings have a variety of useful methods.
  const alpha = "abcdefghijklmnopqrstuvwxyz";
  console.log(alpha.length); // 26
  console.log(alpha.indexOf("efg")); // First occurrence, 4
  console.log(alpha.indexOf("DDDD")); // Returns -1 when not found
  console.log(alpha.includes("efg")); // true
  console.log(alpha.startsWith("abc")); // true
  console.log(alpha.endsWith("xyz")); // true
  console.log(alpha.charAt(11)); // l
  console.log(alpha[11]); // l
  console.log(alpha.toUpperCase()); //ABCDEFGHIJKLMNOPQRSTUVWXYZ
  console.log(alpha.slice(12, 18)); // From position 12 through 17; does not include 18
  console.log(alpha.replace("lmnop", "ponml"));
  console.log(alpha.substring(12, 18)); // mnopqr

  const sentence = "JavaScript is Awesome! JavaScript is fun!";
  const modifiedSentence = sentence.replace("JavaScript","JS");
  console.log(modifiedSentence); // "JS is Awesome! JavaScript is fun!" Replace only the first occurrence



  const phrase = "This is a phrase";
  const words = phrase.split(" "); // Splits at spaces into an array
  console.log(words);

  const padded = "  hello  ";
  console.log(padded.trim()); // "hello"
  console.log("7".padStart(3, "0")); // "007"

  // Comparison is case-sensitive and based on Unicode values.
  const str1 = "aardvark";
  const str2 = "beluga";
  const str3 = "Beluga";

  console.log(str1 < str2); // true
  console.log(str1 < str3); // false
  console.log(str1.localeCompare(str2)); // -1, useful for sorting user-facing text

  // Convert values to strings explicitly.
  const number = 7;
  const myString = String(number).padStart(2, "0");
  console.log(myString);

  const name = "Taylor";
  const age = 30;
  console.log(`Hello, ${name}! You are ${age} years old.`); // Template literals interpolate values
}

strings();
