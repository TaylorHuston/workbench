import Database from "better-sqlite3";
import path from "path";
import { env } from "@/env";

let db:Database.Database | null = null;

export function getDatabase() {
  if (!db) {
    const dbPath = path.resolve(process.cwd(), env.DATABASE_PATH);
    db = new Database(dbPath);

    // Enable WAL mode for better performance
    db.pragma("journal_mode = WAL");

    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  // Simple health_check table for hello world
  db.exec(`
    CREATE TABLE IF NOT EXISTS health_check (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `);
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}