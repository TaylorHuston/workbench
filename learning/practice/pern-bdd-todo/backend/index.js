const express = require("express");
const cors = require("cors");
const pg = require("pg");

const app = express();
app.use(cors());
app.use(express.json());

// Root route. Req represents the request from the users and res is the response object that will be sent back to the users.
app.get("/", (req, res) => {
  res.send("Hello World");
});

app.listen(8888, () => {
  console.log("Server is running on port 8888");
});
