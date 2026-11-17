import { db } from "./db.js";
import { sql } from "drizzle-orm";

const result = async function () {
  try {
    const res = await db.execute(sql`select current_database()`);
    const row = res.rows[0];
    if (!row) {
      throw new Error("No rows returned from database");
    }
    return row["current_database"];
  } finally {
    await db.$client.end();
  }
};

console.log(await result());
