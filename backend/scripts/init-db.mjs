import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { getDatabaseConfig } from "../src/db-config.js";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, "../db/schema.sql");

if (!process.env.DATABASE_URL) {
  throw new Error("缺少 DATABASE_URL（Supabase Session Pooler 连接串）");
}

const sql = await readFile(schemaPath, "utf8");

const client = new Client(getDatabaseConfig());

await client.connect();

try {
  console.log("[db:init] applying schema.sql ...");
  await client.query(sql);
  const result = await client.query(
    "select count(*)::int as count from public.kb_chunks"
  );
  console.log(`[db:init] ok, kb_chunks count=${result.rows[0].count}`);
} finally {
  await client.end();
}
