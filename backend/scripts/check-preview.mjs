const input = process.argv[2];

if (!input) {
  console.error("用法: node scripts/check-preview.mjs 'https://xxx.edgeone.cool/?eo_token=...&eo_time=...'");
  process.exit(1);
}

const previewUrl = new URL(input);
const base = previewUrl.origin;
const ua =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36";

const first = await fetch(previewUrl, {
  redirect: "manual",
  headers: { "User-Agent": ua }
});

console.log(`preview: HTTP ${first.status}`);

const cookies =
  typeof first.headers.getSetCookie === "function" ? first.headers.getSetCookie() : [];

if (!cookies.length) {
  console.error("没有拿到 eo_token cookie，预览链接可能无效或已过期。");
  process.exit(1);
}

const cookie = cookies.map((item) => item.split(";")[0]).join("; ");
console.log("cookie: ok");

async function request(path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "User-Agent": ua,
      Cookie: cookie,
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    // keep text
  }
  return { status: res.status, data };
}

const root = await request("/");
console.log(`root: HTTP ${root.status}`);
if (typeof root.data === "string") {
  console.log(root.data.replace(/\s+/g, " ").slice(0, 300));
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
