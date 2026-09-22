// Syntax that targets the DOM

const domButton = document.getElementById("dom");

function dom() {
  // Grab an element by id. querySelector("#someParent") would also work.
  const myElement = document.getElementById("someParent");

  if (!myElement) {
    console.error("#someParent was not found");
    return;
  }

  // Return the node type.
  // 1: Element
  // 2: Attribute
  // 3: Text
  console.log(myElement.nodeType); // 1

  console.log(myElement.innerHTML);

  // childNodes includes text nodes; children includes only element nodes.
  console.log(myElement.childNodes.length);
  console.log(myElement.children.length);

  // Grab a NodeList of all elements by tag.
  const myLists = document.querySelectorAll("li");
  console.log(myLists.length);

  // Only li elements inside #someParent.
  const someLists = myElement.querySelectorAll("li");
  console.log(someLists.length);

  // You can get and set attributes on elements.
  myElement.setAttribute("class", "someClass");
  console.log(myElement.getAttribute("class"));

  // classList is usually better than replacing the whole className string.
  myElement.classList.add("someOtherClass");
  console.log(myElement.className);

  // Create and append elements.
  const newDiv = document.createElement("div");
  newDiv.textContent = "I'm a generated DIV";
  myElement.append(newDiv);

  // Add styles directly. For larger styling changes, prefer CSS classes.
  myElement.style.backgroundColor = "green";

  // Working with forms.
  const emailField = document.getElementById("email");

  if (emailField) {
    emailField.addEventListener("focus", function () {
      if (emailField.value === "your email") {
        emailField.value = "";
      }
    });

    emailField.addEventListener("blur", function () {
      if (emailField.value === "") {
        emailField.value = "your email";
      }
    });
  }

  const myForm = document.getElementById("myForm");

  if (myForm) {
    myForm.addEventListener("submit", function (event) {
      event.preventDefault();

      const checkbox = document.getElementById("myCheckbox");
      if (checkbox && checkbox.checked) {
        console.log("The checkbox is checked");
      } else {
        console.log("The checkbox isn't checked");
      }
    });
  }

  const button = document.getElementById("my-button");

  if (button) {
    button.addEventListener("click", function () {
      console.log("You clicked me!");
    });
  }
}

if (domButton) {
  domButton.addEventListener("click", dom);
}
