import pg from "pg";
import { getDatabaseConfig } from "./db-config.js";

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL_NOT_CONFIGURED");
  }

  if (!pool) {
    pool = new Pool({
      ...getDatabaseConfig(),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000
    });
  }

  return pool;
}

// 每次取连接后显式设置 search_path，兼容 vector 扩展在 extensions schema 的 Supabase
export async function withClient(fn) {
  const client = await getPool().connect();
  try {
    await client.query("set search_path = public, extensions");
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
