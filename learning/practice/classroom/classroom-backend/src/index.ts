import express from "express";
import cors from "cors";
import { auth } from "./lib/auth.js";

import subjectsRouter from "./routes/subjects.js";
import { toNodeHandler } from "better-auth/node";

const app = express();
const port = 8000;

if (!process.env.FRONTEND_URL) {
  throw new Error("FRONTEND_URL is not defined in the environment variables");
}

app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL, methods: ["GET", "POST", "PUT", "DELETE"], credentials: true }));

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use("/api/subjects", subjectsRouter);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
