import "dotenv/config";

const key = process.env.EMBEDDING_API_KEY;
if (!key) {
  console.error("EMBEDDING_API_KEY is empty");
  process.exit(1);
}

const candidates = [
  "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "https://coding.dashscope.aliyuncs.com/v1",
  "https://coding.dashscope.aliyuncs.com/compatible-mode/v1",
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
];

const model = process.env.EMBEDDING_MODEL || "qwen3.7-text-embedding";

for (const baseURL of candidates) {
  console.log(`\n=== ${baseURL} ===`);

  try {
    const modelsRes = await fetch(`${baseURL}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000)
    });
    const modelsText = await modelsRes.text();
    let modelIds = [];
    try {
      const parsed = JSON.parse(modelsText);
      modelIds = Array.isArray(parsed.data) ? parsed.data.map((m) => m.id).slice(0, 8) : [];
    } catch {}
    console.log(`models: HTTP ${modelsRes.status} ${modelIds.length ? modelIds.join(", ") : modelsText.slice(0, 160)}`);
  } catch (err) {
    console.log(`models: ${err.message}`);
  }

  try {
    const body = {
      model,
      input: "测试文本",
      dimensions: 1024
    };
    const res = await fetch(`${baseURL}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000)
    });
    const text = await res.text();
    let message = text.slice(0, 220);
    try {
      const parsed = JSON.parse(text);
      message = parsed.error?.message || parsed.message || message;
    } catch {}
    console.log(`embedding: HTTP ${res.status} ${message}`);
  } catch (err) {
    console.log(`embedding: ${err.message}`);
  }
}
