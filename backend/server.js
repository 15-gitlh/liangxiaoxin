import "dotenv/config";
import app from "./app.js";

const PORT = Number(process.env.PORT || 8080);

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`[agent] listening on http://0.0.0.0:${PORT}`);
  console.log(`[agent] llm configured: ${Boolean(process.env.LLM_API_KEY)}`);
});

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    console.log(`[agent] ${signal} received, shutting down`);
    server.close(() => process.exit(0));
  });
}

export { app };
