// Ad-hoc DDL runner against the direct Postgres connection (PG* env vars from .env.local).
// Usage: node scripts/migrate.js path/to/file.sql
const { Client } = require("pg");
const fs = require("fs");

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/migrate.js <sql-file>");
  process.exit(1);
}

const sql = fs.readFileSync(file, "utf8");

(async () => {
  const client = new Client({ ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    console.log("OK");
  } finally {
    await client.end();
  }
})().catch((err) => {
  console.error("MIGRATION FAILED:", err.message);
  process.exit(1);
});
