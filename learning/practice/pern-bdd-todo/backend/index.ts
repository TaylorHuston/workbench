import express from "express";
import cors from "cors";
import pg from "pg";
import { db } from "./db.js";
import { sql } from "drizzle-orm";

const app = express();
app.use(cors());
app.use(express.json());
const port = Number(process.env.PORT ?? 8888);

// Root route. Req represents the request from the users and res is the response object that will be sent back to the users.
app.get("/", (req, res) => {
  res.send("Hello World");
});

if (process.env.NODE_ENV === "test") {
  const result = await db.execute(sql<{ name: string }>`SELECT current_database() AS name`);
  if (result.rows[0]?.name !== "todo_test") {
    throw new Error("Test backend must connect to todo_test");
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
