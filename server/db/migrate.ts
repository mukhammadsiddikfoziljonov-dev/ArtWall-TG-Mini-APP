import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { Client } from "pg";

loadEnv({ path: ".env.local" });
loadEnv();

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is required");

const client = new Client({ connectionString });
const migrationDirectory = path.resolve(process.cwd(), "drizzle");

await client.connect();
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS artwall_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const applied = new Set((await client.query<{ name: string }>("SELECT name FROM artwall_migrations")).rows.map((row) => row.name));
  const files = fs.readdirSync(migrationDirectory).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationDirectory, file), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO artwall_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}

