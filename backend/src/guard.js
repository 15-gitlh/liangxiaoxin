import { createHash } from "node:crypto";
import { withClient } from "./db.js";

const TABLE_MISSING = "42P01";

function numberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = String(raw || "").split(",")[0].trim();
  const ip = first || req.headers["x-real-ip"] || req.ip || req.socket?.remoteAddress || "unknown";
  return String(ip).replace(/^::ffff:/, "");
}

export function hashIp(ip) {
  const salt = process.env.IP_HASH_SALT || process.env.ADMIN_TOKEN || "liangxiaoxin-demo";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export function normalizeQuestion(message) {
  return String(message || "")
    .toLowerCase()
    .replace(/[，。！？、；：,.!?;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function makeCacheKey(message) {
  const normalized = normalizeQuestion(message);
  return createHash("sha256").update(normalized).digest("hex").slice(0, 32);
}

export async function checkDailyLimit(ip) {
  const limit = numberEnv("CHAT_DAILY_LIMIT", 50);

  try {
    const count = await withClient(async (client) => {
      const result = await client.query(
        `insert into public.chat_usage (ip_hash, day, count)
         values ($1, current_date, 1)
         on conflict (ip_hash, day)
         do update set count = public.chat_usage.count + 1
         returning count`,
        [hashIp(ip)]
      );
      return Number(result.rows[0].count);
    });

    return { allowed: count <= limit, count, limit };
  } catch (err) {
    // 表还没建时不阻塞问答；建表后自动生效
    if (err.code === TABLE_MISSING) {
      console.warn("[guard] chat_usage table missing, daily limit disabled");
      return { allowed: true, count: 0, limit, disabled: true };
    }
    throw err;
  }
}

export async function readCache(message) {
  const hours = numberEnv("CHAT_CACHE_HOURS", 24);
  if (!hours) return null;

  try {
    return await withClient(async (client) => {
      const result = await client.query(
        `select payload
         from public.chat_cache
         where cache_key = $1 and expires_at > now()
         limit 1`,
        [makeCacheKey(message)]
      );
      return result.rows[0]?.payload || null;
    });
  } catch (err) {
    if (err.code === TABLE_MISSING) {
      console.warn("[guard] chat_cache table missing, cache disabled");
      return null;
    }
    throw err;
  }
}

export async function writeCache(message, payload) {
  const hours = numberEnv("CHAT_CACHE_HOURS", 24);
  if (!hours) return;

  try {
    await withClient(async (client) => {
      await client.query(
        `insert into public.chat_cache (cache_key, payload, expires_at)
         values ($1, $2::jsonb, now() + make_interval(hours => $3))
         on conflict (cache_key)
         do update set payload = excluded.payload, expires_at = excluded.expires_at`,
        [makeCacheKey(message), JSON.stringify(payload), Math.round(hours)]
      );
    });
  } catch (err) {
    if (err.code !== TABLE_MISSING) {
      console.warn("[guard] cache write failed:", err.message);
    }
  }
}
