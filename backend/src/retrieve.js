import { withClient } from "./db.js";
import { embedQuery } from "./embedding.js";
import { toVectorLiteral } from "./vector.js";

const VECTOR_SQL = `
  select
    chunk_id,
    entry_id,
    category,
    title,
    status,
    content,
    source,
    source_url,
    source_page,
    updated,
    1 - (embedding <=> $1::vector) as score
  from public.kb_chunks
  where embedding is not null
  order by embedding <=> $1::vector
  limit $2
`;

const KEYWORD_SQL = `
  select
    chunk_id,
    entry_id,
    category,
    title,
    status,
    content,
    source,
    source_url,
    source_page,
    updated,
    0.2::float8 as score
  from public.kb_chunks
  where
    search_text ilike any($1::text[])
    or title ilike any($1::text[])
  order by
    case when title ilike any($1::text[]) then 0 else 1 end,
    length(title)
  limit $2
`;

function mapRow(row) {
  return {
    chunkId: row.chunk_id,
    entryId: row.entry_id,
    category: row.category,
    title: row.title,
    status: row.status,
    content: row.content,
    source: row.source,
    sourceUrl: row.source_url,
    sourcePage: row.source_page,
    updated: row.updated,
    score: Number(row.score) || 0
  };
}

function buildPatterns(question) {
  const cleaned = String(question || "")
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9]+/g, " ")
    .trim();

  const parts = cleaned.split(/\s+/).filter((part) => part.length >= 2);
  const terms = new Set(parts);

  for (const part of parts) {
    if (part.length > 2) {
      for (let i = 0; i <= part.length - 2; i += 1) {
        terms.add(part.slice(i, i + 2));
      }
    }
  }

  return [...terms].slice(0, 8).map((term) => `%${term}%`);
}

export async function retrieve(question) {
  const q = String(question || "").trim();
  if (!q) return [];

  const topK = Number(process.env.RETRIEVAL_TOP_K || 5);
  const minScore = Number(process.env.RETRIEVAL_MIN_SCORE || 0.35);
  const queryVector = await embedQuery(q);

  return withClient(async (client) => {
    const vectorResult = await client.query(VECTOR_SQL, [
      toVectorLiteral(queryVector),
      topK
    ]);

    const results = vectorResult.rows.map(mapRow);
    const bestScore = results[0]?.score ?? 0;

    if (bestScore < minScore) {
      const patterns = buildPatterns(q);
      if (patterns.length) {
        const keywordResult = await client.query(KEYWORD_SQL, [patterns, topK]);
        const seen = new Set(results.map((item) => item.chunkId));

        for (const row of keywordResult.rows) {
          const item = mapRow(row);
          if (!seen.has(item.chunkId)) {
            item.score = Math.max(item.score, 0.2);
            results.push(item);
            seen.add(item.chunkId);
          }
        }
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  });
}
