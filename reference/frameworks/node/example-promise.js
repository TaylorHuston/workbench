// Demonstrates creating and using a Promise in Node.js

const myPromise = new Promise((resolve, reject) => {
  // Simulate an async operation (e.g., API call, file read)
  setTimeout(() => {
    const success = Math.random() > 0.5;

    if (success) {
      resolve("Operation completed successfully");
    } else {
      reject(new Error("Operation failed"));
    }
  }, 1000); // Simulate delay
});

// Using the Promise
myPromise.then((result) => console.log("Success:", result)).catch((error) => console.error("Error:", error.message));
