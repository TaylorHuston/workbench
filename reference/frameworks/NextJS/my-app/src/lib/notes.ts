import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// This file is server-only. It uses Node.js modules and better-sqlite3, so do
// not import it into a Client Component. Next file to read:
// src/app/database/submit-button.tsx.

const dataDirectory = path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "next-reference.sqlite");

export type Note = {
  id: number;
  body: string;
  created_at: string;
};

function openDatabase(): Database.Database {
  // process.cwd() points at the project root when the Next server runs. This
  // creates data/ on first use so the local SQLite file has a place to live.
  fs.mkdirSync(dataDirectory, { recursive: true });

  // openDatabase centralizes setup so every read/write uses the same local file.
  const db = new Database(databasePath);

  // WAL is a common SQLite journal mode that improves local read/write behavior.
  db.pragma("journal_mode = WAL");

  // Ensure the table exists before any route tries to read or write notes.
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
}

export function getNotes(): Note[] {
  const db = openDatabase();

  try {
    // better-sqlite3 cannot infer row shapes from SQL text. The assertion tells
    // TypeScript these selected columns match the Note type above.
    return db.prepare("SELECT id, body, created_at FROM notes ORDER BY id DESC LIMIT 10").all() as Note[];
  } finally {
    // Always close the connection, even if the query throws.
    db.close();
  }
}

export function insertNote(body: string): void {
  const db = openDatabase();

  try {
    // The ? placeholder keeps user input separate from SQL text.
    db.prepare("INSERT INTO notes (body) VALUES (?)").run(body);
  } finally {
    db.close();
  }
}

export function removeNote(id: number): void {
  const db = openDatabase();

  try {
    // Prepared statements protect this delete query the same way as insertNote.
    db.prepare("DELETE FROM notes WHERE id = ?").run(id);
  } finally {
    db.close();
  }
}
