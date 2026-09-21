import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "../config.ts";
import * as schema from "./schema.ts";

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.nodeEnv === "production" ? 10 : 4,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
});

export const db = drizzle(pool, { schema });

