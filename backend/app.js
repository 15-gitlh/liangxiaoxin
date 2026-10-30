import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { answerQuestion } from "./src/agent.js";

const app = express();

const ORIGINS = String(
  process.env.CORS_ORIGINS ||
    "https://15-gitlh.github.io,http://localhost:8787,http://127.0.0.1:8787"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const ADMIN_TOKEN = String(process.env.ADMIN_TOKEN || "");

app.disable("x-powered-by");
app.set("trust proxy", 1);

// API 只返回 JSON，允许跨域读取
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);
app.use(express.json({ limit: "512kb" }));

app.use(
  cors({
    origin(origin, callback) {
      // curl / 服务端调用没有 Origin，直接放行
      if (!origin) return callback(null, true);
      if (ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin not allowed: ${origin}`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
    optionsSuccessStatus: 204
  })
);

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "rate_limited", message: "请求太频繁，请稍后再试。" }
  })
);

const ChatBody = z.object({
  message: z.string().trim().min(1).max(2000),
  sessionId: z.string().trim().min(1).max(100).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(4000)
      })
    )
    .max(10)
    .optional()
});

const FeedbackBody = z.object({
  requestId: z.string().trim().min(1).max(100),
  rating: z.enum(["up", "down"]),
  comment: z.string().trim().max(1000).optional()
});

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ error: "admin_disabled" });
  }
  const auth = req.get("authorization") || "";
  if (auth !== `Bearer ${ADMIN_TOKEN}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
}

app.get("/", (req, res) => {
  res.json({
    service: "liangxiaoxin-agent",
    version: "0.1.0",
    endpoints: ["/health", "/api/chat", "/api/feedback"]
  });
});

function healthPayload() {
  return {
    ok: true,
    service: "liangxiaoxin-agent",
    version: "0.1.0",
    uptime: Math.round(process.uptime()),
    llmConfigured: Boolean(process.env.LLM_API_KEY),
    embeddingConfigured: Boolean(process.env.EMBEDDING_API_KEY),
    timestamp: new Date().toISOString()
  };
}

app.get("/health", (req, res) => {
  res.json(healthPayload());
});

// EdgeOne Cloud Functions 挂在 /api 前缀下，方便做健康检查
app.get("/api/health", (req, res) => {
  res.json(healthPayload());
});

app.post("/api/chat", async (req, res, next) => {
  try {
    const parsed = ChatBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "invalid_request",
        details: parsed.error.flatten()
      });
    }

    const { message, sessionId, history } = parsed.data;
    const requestId = randomUUID();
    const started = Date.now();
    res.setHeader("X-Request-Id", requestId);

    const result = await answerQuestion({
      message,
      history: history || []
    });

    return res.json({
      requestId,
      sessionId: sessionId || requestId,
      ...result,
      latencyMs: Date.now() - started
    });
  } catch (err) {
    const configErrors = new Set([
      "LLM_NOT_CONFIGURED",
      "EMBEDDING_NOT_CONFIGURED",
      "DATABASE_URL_NOT_CONFIGURED"
    ]);

    if (configErrors.has(err.message)) {
      return res.status(503).json({
        error: err.message.toLowerCase(),
        message: "后端依赖未配置完整，请检查 backend/.env。",
        handoff: true
      });
    }

    return next(err);
  }
});

app.post("/api/feedback", (req, res) => {
  const parsed = FeedbackBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid_request",
      details: parsed.error.flatten()
    });
  }

  // Step 2 之后写入数据库；现在先落日志，方便本地验证。
  console.log("[feedback]", JSON.stringify({ ...parsed.data, at: new Date().toISOString() }));
  return res.status(202).json({ ok: true });
});

app.post("/api/admin/reindex", requireAdmin, (req, res) => {
  res.status(501).json({
    error: "not_implemented",
    message: "Step 2 接入：读取 kb.json -> 切分 -> embedding -> 写入 pgvector。"
  });
});

app.use((req, res) => {
  res.status(404).json({ error: "not_found", path: req.path });
});

app.use((err, req, res, next) => {
  if (String(err.message || "").startsWith("Origin not allowed:")) {
    return res.status(403).json({ error: "cors_origin_denied", message: err.message });
  }
  console.error("[error]", err);
  return res.status(500).json({ error: "internal_error" });
});

export default app;
