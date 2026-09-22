// Timer-related events in JavaScript

function simpleMessage() {
  console.log("5 seconds have passed");
}

// Run once after 5 seconds. The delay is in milliseconds.
setTimeout(simpleMessage, 5000);

const myImage = document.getElementById("slideImage");
const images = ["_images/cat1.jpg", "_images/cat2.jpg", "_images/cat3.jpg"];
let slideIndex = 0;
let myInterval;

function slideshow() {
  myImage.setAttribute("src", images[slideIndex]);
  slideIndex = (slideIndex + 1) % images.length;
}

if (myImage) {
  slideshow();

  // Run every 5 seconds until the interval is cleared.
  myInterval = setInterval(slideshow, 5000);

  // Stop the interval if the user clicks the image.
  myImage.addEventListener("click", function () {
    clearInterval(myInterval);
    console.log("Slideshow stopped");
  });
}

// clearTimeout() cancels a timeout that has not run yet.
const timeoutId = setTimeout(function () {
  console.log("This message will not run");
}, 1000);
clearTimeout(timeoutId);
