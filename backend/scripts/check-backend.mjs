const input = process.argv[2] || process.env.API_BASE;

if (!input) {
  console.error("用法: node scripts/check-backend.mjs https://你的后端域名");
  process.exit(1);
}

const base = input.trim().replace(/\/$/, "");

async function request(path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    signal: AbortSignal.timeout(60_000)
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

const health = await request("/api/health");
console.log(`health: HTTP ${health.status}`);
console.log(JSON.stringify(health.data, null, 2));

const chat = await request("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "宿舍门禁几点？" })
});

console.log(`\nchat: HTTP ${chat.status}`);
if (chat.data && typeof chat.data === "object") {
  console.log("answer:", String(chat.data.answer || "").slice(0, 300));
  console.log(
    "citations:",
    Array.isArray(chat.data.citations)
      ? chat.data.citations.map((item) => `${item.id}(${item.score})`).join(", ")
      : ""
  );
} else {
  console.log(chat.data);
}
