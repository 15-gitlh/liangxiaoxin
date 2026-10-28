/* 量小新 · 可选服务端
 * 1) 托管静态文件
 * 2) /api/chat 代理 OpenAI 兼容接口（key 只在服务端）
 *
 * 运行：
 *   set LLM_API_KEY=sk-xxx
 *   set LLM_BASE_URL=https://api.openai.com/v1
 *   set LLM_MODEL=gpt-4o-mini
 *   node server.mjs
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const HOST = String(process.env.HOST || "127.0.0.1");
const API_BASE = String(process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const API_KEY = String(process.env.LLM_API_KEY || "");
const MODEL = String(process.env.LLM_MODEL || "gpt-4o-mini");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    sendJSON(res, 400, { error: "bad url" });
    return;
  }
  if (pathname === "/") pathname = "/index.html";
  const file = path.resolve(__dirname, "." + pathname);
  if (file !== __dirname && !file.startsWith(__dirname + path.sep)) {
    sendJSON(res, 403, { error: "forbidden" });
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      sendJSON(res, 404, { error: "not found" });
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Content-Length": data.length,
      "Cache-Control": "no-cache"
    });
    res.end(req.method === "HEAD" ? undefined : data);
  });
}

async function handleChat(req, res) {
  if (!API_KEY) {
    sendJSON(res, 500, { error: "LLM_API_KEY 未配置" });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch {
    sendJSON(res, 400, { error: "invalid json" });
    return;
  }

  const question = String(payload.question || "").slice(0, 600);
  if (!question) {
    sendJSON(res, 400, { error: "question required" });
    return;
  }

  const context = Array.isArray(payload.context) ? payload.context.slice(0, 5) : [];
  const contextText = context.map((c, i) => {
    const title = String(c.title || "").slice(0, 120);
    const answer = String(c.answer || "").slice(0, 900);
    const source = String(c.source || "").slice(0, 160);
    return `【资料${i + 1}】${title}\n${answer}\n来源：${source}`;
  }).join("\n\n");

  const system = [
    "你是中国计量大学新生助手“量小新”。",
    "只根据下面提供的资料回答；资料没有的信息，直接说“我不确定，建议转人工或查看学校官方通知”。",
    "不要编造日期、金额、电话、网址。回答简洁，分点，必要时给出下一步。",
    "不回答与迎新/校园生活无关的问题。",
    "",
    "资料：",
    contextText || "（无）"
  ].join("\n");

  try {
    const upstream = await fetch(`${API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: question }
        ],
        temperature: 0.2,
        max_tokens: 700
      })
    });

    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 400);
      sendJSON(res, 502, { error: "upstream failed", detail });
      return;
    }

    const data = await upstream.json();
    const answer = data?.choices?.[0]?.message?.content || "";
    if (!answer) {
      sendJSON(res, 502, { error: "empty answer" });
      return;
    }

    sendJSON(res, 200, {
      answer,
      sources: context.map((c) => String(c.title || ""))
    });
  } catch (err) {
    sendJSON(res, 502, { error: "upstream error", detail: String(err?.message || err).slice(0, 300) });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url.startsWith("/api/chat")) {
    handleChat(req, res);
    return;
  }
  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
    return;
  }
  sendJSON(res, 405, { error: "method not allowed" });
});

server.listen(PORT, HOST, () => {
  console.log(`量小新 demo: http://${HOST}:${PORT}`);
  console.log(API_KEY ? `LLM: ${MODEL} @ ${API_BASE}` : "LLM: 未配置（前端会回退到本地知识库）");
});
