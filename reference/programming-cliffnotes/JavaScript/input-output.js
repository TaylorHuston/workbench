// Input and output in the context of a browser window

const inputButton = document.getElementById("inputOutput");

function inputOutput() {
  // alert(), confirm(), and prompt() are built-in browser dialogs. They are useful
  // for quick demos, but real applications usually use custom UI instead.
  alert("I am an alert box");

  const confirmed = confirm("I am a confirm box. Click OK to continue.");
  console.log(`User clicked ${confirmed ? "OK" : "Cancel"}`);

  const someVal = prompt("Use a prompt to get data");

  // prompt() returns null if the user clicks Cancel.
  if (someVal === null) {
    alert("You canceled the prompt.");
  } else {
    alert(`You input ${someVal}`);
  }

  // Console output is visible in browser developer tools.
  console.log("I'm printed to the console");
  console.log(10 < 5); // Can print boolean
  console.log("blahblahblah".substring(3, 7));

  // Other console methods can help distinguish message types.
  console.error("I am an error");
  console.info("I'm for general info");
  console.debug("I am a debug message");
  console.warn("I am a warning");
}

if (inputButton) {
  inputButton.addEventListener("click", inputOutput);
}
