import { getDatabase, closeDatabase } from "@/lib/db";

function seed() {
  const db = getDatabase();
  const insert = db.prepare(`
    INSERT INTO health_check (message) VALUES (?)
  `);

  insert.run("Database initialized and seeded.");
  console.log("Database seeded successfully.");
  closeDatabase();
}

seed();