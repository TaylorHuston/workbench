import { db } from "./index.js";
import { sql } from "drizzle-orm";

console.log(await db.execute(sql`SELECT 1`));
