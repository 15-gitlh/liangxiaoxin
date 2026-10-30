import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import pg from "pg";
import { getDatabaseConfig } from "../src/db-config.js";

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const kbPath = path.resolve(__dirname, "../data/kb.json");

const DATABASE_URL = process.env.DATABASE_URL;
const EMBEDDING_API_KEY = process.env.EMBEDDING_API_KEY;
const EMBEDDING_BASE_URL =
  process.env.EMBEDDING_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "qwen3.7-text-embedding";
const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM || 1024);
const BATCH_SIZE = Number(process.env.EMBEDDING_BATCH_SIZE || 10);
const SEND_DIMENSIONS = process.env.EMBEDDING_SEND_DIMENSIONS !== "false";

if (!DATABASE_URL) {
  throw new Error("缺少 DATABASE_URL（Supabase Session Pooler 连接串）");
}
if (!EMBEDDING_API_KEY) {
  throw new Error("缺少 EMBEDDING_API_KEY（Qwen DashScope API Key）");
}
if (!Number.isInteger(EMBEDDING_DIM) || EMBEDDING_DIM <= 0) {
  throw new Error("EMBEDDING_DIM 必须是正整数，例如 1024");
}
if (!Number.isInteger(BATCH_SIZE) || BATCH_SIZE < 1) {
  throw new Error("EMBEDDING_BATCH_SIZE 必须是正整数");
}

const doc = JSON.parse(await readFile(kbPath, "utf8"));
const entries = doc.entries;

if (!Array.isArray(entries) || entries.length === 0) {
  throw new Error("kb.json 没有 entries");
}

console.log(`[ingest] kb.json entries=${entries.length} categories=${doc.categories?.length || 0}`);
console.log(
  `[ingest] embedding model=${EMBEDDING_MODEL} dim=${EMBEDDING_DIM} batch=${BATCH_SIZE}`
);

const embedder = new OpenAI({
  apiKey: EMBEDDING_API_KEY,
  baseURL: EMBEDDING_BASE_URL
});

const pool = new Pool({
  ...getDatabaseConfig(),
  max: 2
});

const UPSERT_SQL = `
insert into public.kb_chunks (
  chunk_id, entry_id, doc_type, category, title, status,
  content, search_text, source, source_url, source_page, updated,
  content_hash, embedding, metadata, updated_at
) values (
  $1, $2, $3, $4, $5, $6,
  $7, $8, $9, $10, $11, $12,
  $13, $14::vector, $15::jsonb, now()
)
on conflict (chunk_id) do update set
  entry_id = excluded.entry_id,
  doc_type = excluded.doc_type,
  category = excluded.category,
  title = excluded.title,
  status = excluded.status,
  content = excluded.content,
  search_text = excluded.search_text,
  source = excluded.source,
  source_url = excluded.source_url,
  source_page = excluded.source_page,
  updated = excluded.updated,
  content_hash = excluded.content_hash,
  embedding = excluded.embedding,
  metadata = excluded.metadata,
  updated_at = now()
`;

function toVectorLiteral(vector) {
  return `[${vector.join(",")}]`;
}

async function embedBatch(texts) {
  const payload = {
    model: EMBEDDING_MODEL,
    input: texts
  };

  // Qwen qwen3.7-text-embedding 支持 dimensions；如果供应商不认这个参数，
  // 在 .env 里设 EMBEDDING_SEND_DIMENSIONS=false。
  if (SEND_DIMENSIONS) {
    payload.dimensions = EMBEDDING_DIM;
  }

  const result = await embedder.embeddings.create(payload);

  if (!Array.isArray(result.data) || result.data.length !== texts.length) {
    throw new Error(
      `embedding 返回数量不匹配: expected=${texts.length} got=${result.data?.length}`
    );
  }

  return result.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((item) => {
      const vector = item.embedding;
      if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIM) {
        throw new Error(
          `embedding 维度不匹配: expected=${EMBEDDING_DIM} got=${vector?.length}`
        );
      }
      return vector;
    });
}

async function main() {
  const client = await pool.connect();
  let written = 0;

  try {
    // 兼容 Supabase 把 vector 扩展装在 extensions schema 的情况
    await client.query("set search_path = public, extensions");
    await client.query("begin");

    for (let start = 0; start < entries.length; start += BATCH_SIZE) {
      const batch = entries.slice(start, start + BATCH_SIZE);
      const vectors = await embedBatch(batch.map((entry) => entry.content));

      for (let i = 0; i < batch.length; i += 1) {
        const entry = batch[i];
        await client.query(UPSERT_SQL, [
          entry.chunkId,
          entry.id,
          entry.docType,
          entry.category,
          entry.title,
          entry.status,
          entry.content,
          entry.searchText,
          entry.source,
          entry.sourceUrl,
          entry.sourcePage,
          entry.updated,
          entry.contentHash,
          toVectorLiteral(vectors[i]),
          JSON.stringify({
            aliases: entry.aliases,
            keywords: entry.keywords,
            followups: entry.followups
          })
        ]);
        written += 1;
      }

      console.log(`[ingest] ${Math.min(start + BATCH_SIZE, entries.length)}/${entries.length}`);
    }

    const check = await client.query(
      "select count(*)::int as count, count(embedding)::int as embedded from public.kb_chunks"
    );

    await client.query("commit");

    // 知识更新后清掉旧问答缓存，避免 24 小时内继续返回旧答案
    try {
      const cleared = await client.query("delete from public.chat_cache");
      console.log(`[ingest] cache cleared=${cleared.rowCount}`);
    } catch (err) {
      if (err.code !== "42P01") {
        console.warn("[ingest] cache clear failed:", err.message);
      }
    }

    console.log(`[ingest] written=${written}`);
    console.log(
      `[ingest] db count=${check.rows[0].count} embedded=${check.rows[0].embedded}`
    );
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error("[ingest] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
