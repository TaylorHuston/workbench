import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

const databaseName = async function () {
  try {
    await client.connect();
    const res = await client.query("select current_database()");
    return res.rows[0]["current_database"];
  } finally {
    await client.end();
  }
};

console.log(await databaseName());
