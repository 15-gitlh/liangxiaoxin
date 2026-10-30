const base = (process.argv[2] || "https://agent.liangxiaoxin.top").replace(/\/$/, "");
const origin = "https://15-gitlh.github.io";

const questions = [
  "宿舍门禁几点？",
  "学费多少？怎么缴？",
  "军训要准备什么？",
  "报到需要带什么？",
  "学校有几个校区？",
  "今天天气怎么样？"
];

const results = [];

async function timedFetch(url, options = {}) {
  const started = performance.now();
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(60_000)
  });
  const latencyMs = Math.round(performance.now() - started);
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, latencyMs, data, text };
}

console.log(`base: ${base}`);
console.log("--- health ---");

for (let i = 1; i <= 3; i++) {
  const r = await timedFetch(`${base}/api/health`);
  console.log(
    `health #${i}: HTTP ${r.status} ${r.latencyMs}ms`,
    r.data && typeof r.data === "object"
      ? `llm=${r.data.llmConfigured} emb=${r.data.embeddingConfigured}`
      : String(r.data).slice(0, 100)
  );
}

console.log("\n--- cors preflight ---");
const pre = await timedFetch(`${base}/api/chat`, {
  method: "OPTIONS",
  headers: {
    Origin: origin,
    "Access-Control-Request-Method": "POST",
    "Access-Control-Request-Headers": "content-type"
  }
});
console.log(`preflight: HTTP ${pre.status} allow-origin=${pre.data && typeof pre.data === "object" ? "json" : ""}`);

console.log("\n--- chat rounds ---");

for (let round = 1; round <= 2; round++) {
  for (const question of questions) {
    try {
      const r = await timedFetch(`${base}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin
        },
        body: JSON.stringify({ message: question })
      });

      const data = r.data && typeof r.data === "object" ? r.data : {};
      const citations = Array.isArray(data.citations) ? data.citations : [];
      const ok = r.status === 200 && Boolean(data.answer);

      results.push({ round, question, status: r.status, latencyMs: r.latencyMs, ok });

      console.log(
        `#${results.length} [${ok ? "OK" : "FAIL"}] HTTP ${r.status} ${r.latencyMs}ms`,
        `handoff=${data.handoff}`,
        `conf=${data.confidence}`,
        `cites=${citations.map((c) => c.id).join(",")}`,
        `q=${question}`
      );

      if (!ok) {
        console.log("  body:", String(r.text).slice(0, 300));
      }
    } catch (err) {
      results.push({ round, question, status: 0, latencyMs: 0, ok: false });
      console.log(`#${results.length} [ERROR] ${question}: ${err.message}`);
    }
  }
}

console.log("\n--- concurrent 3 ---");
const concurrentQuestions = ["宿舍门禁几点？", "学费多少？", "军训要准备什么？"];
const concurrent = await Promise.all(
  concurrentQuestions.map(async (question) => {
    try {
      const r = await timedFetch(`${base}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin },
        body: JSON.stringify({ message: question })
      });
      const data = r.data && typeof r.data === "object" ? r.data : {};
      return { question, status: r.status, latencyMs: r.latencyMs, ok: Boolean(data.answer) };
    } catch (err) {
      return { question, status: 0, latencyMs: 0, ok: false, error: err.message };
    }
  })
);

for (const item of concurrent) {
  console.log(
    `concurrent [${item.ok ? "OK" : "FAIL"}] HTTP ${item.status} ${item.latencyMs}ms ${item.question}`
  );
}

const all = results.concat(concurrent.map((item) => ({ ...item, round: "concurrent" })));
const okCount = all.filter((item) => item.ok).length;
const latencies = all.filter((item) => item.latencyMs > 0).map((item) => item.latencyMs);
const avg = latencies.length
  ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
  : 0;
const max = latencies.length ? Math.max(...latencies) : 0;
const min = latencies.length ? Math.min(...latencies) : 0;

console.log("\n--- summary ---");
console.log(`success: ${okCount}/${all.length}`);
console.log(`latency: min=${min}ms avg=${avg}ms max=${max}ms`);

if (okCount !== all.length) {
  process.exitCode = 1;
}
