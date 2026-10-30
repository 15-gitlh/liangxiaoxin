import app from "../../backend/app.js";

// EdgeOne Cloud Function 挂在 /api/* 下。
// 有的运行时会把前缀剥掉（/chat），这里统一补回 /api，交给 Express 路由。
export default function handler(req, res) {
  const url = req.url || "/";

  if (!url.startsWith("/api/") && url !== "/api") {
    req.url = "/api" + (url.startsWith("/") ? url : `/${url}`);
  }

  return app(req, res);
}
