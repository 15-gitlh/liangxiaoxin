import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const kbPath = path.join(root, "kb.js");
const outDir = path.resolve(__dirname, "../data");
const outPath = path.join(outDir, "kb.json");

const CATEGORY_ORDER = [
  "报到",
  "缴费奖助",
  "宿舍生活",
  "校区交通",
  "学习教务",
  "军训体检",
  "安全防骗",
  "家长/心理"
];

globalThis.window = {};
await import(pathToFileURL(kbPath).href);

const raw = globalThis.window.LXX_KB;
if (!Array.isArray(raw) || raw.length === 0) {
  throw new Error("kb.js 没有导出有效的 window.LXX_KB");
}

const ids = new Set();
const unknownCategories = new Set();

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parsePage(source) {
  const range = String(source || "").match(/第\s*(\d+)\s*[–\-~至]\s*(\d+)\s*页/);
  if (range) return `${range[1]}-${range[2]}`;
  const single = String(source || "").match(/第\s*(\d+)\s*页/);
  return single ? single[1] : "";
}

const entries = raw.map((item) => {
  if (!item.id || !item.title || !item.category) {
    throw new Error(`知识条目缺字段: ${JSON.stringify(item).slice(0, 120)}`);
  }
  if (ids.has(item.id)) {
    throw new Error(`重复 id: ${item.id}`);
  }
  ids.add(item.id);

  if (!CATEGORY_ORDER.includes(item.category)) {
    unknownCategories.add(item.category);
  }

  const steps = Array.isArray(item.steps) ? item.steps.map(clean).filter(Boolean) : [];
  const aliases = Array.isArray(item.aliases) ? item.aliases.map(clean).filter(Boolean) : [];
  const keywords = Array.isArray(item.keywords) ? item.keywords.map(clean).filter(Boolean) : [];
  const followups = Array.isArray(item.followups) ? item.followups.map(clean).filter(Boolean) : [];
  const answer = String(item.answer || "").trim();
  const source = clean(item.source);

  const content = [
    `标题：${item.title}`,
    `分类：${item.category}`,
    `答案：${answer}`,
    steps.length ? `步骤：${steps.map((s, i) => `${i + 1}. ${s}`).join("；")}` : "",
    source ? `来源：${source}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: item.id,
    docType: "faq",
    chunkId: `faq:${item.id}`,
    category: item.category,
    title: item.title,
    aliases,
    keywords,
    status: item.status || "general",
    answer,
    steps,
    followups,
    source,
    sourceUrl: item.sourceUrl || "",
    sourcePage: parsePage(source),
    updated: item.updated || "",
    lang: "zh-CN",
    searchText: [item.title, ...aliases, ...keywords, answer, ...steps].join(" "),
    content,
    contentHash: createHash("sha256").update(content).digest("hex").slice(0, 16)
  };
});

const categories = CATEGORY_ORDER.map((name) => ({
  name,
  count: entries.filter((entry) => entry.category === name).length
})).filter((category) => category.count > 0);

const statusCounts = entries.reduce((acc, entry) => {
  acc[entry.status] = (acc[entry.status] || 0) + 1;
  return acc;
}, {});

const doc = {
  schemaVersion: "1.0",
  generatedAt: new Date().toISOString(),
  generatedFrom: "kb.js",
  count: entries.length,
  categoryOrder: CATEGORY_ORDER,
  categories,
  statusCounts,
  entries
};

await mkdir(outDir, { recursive: true });
await writeFile(outPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");

console.log(`[export-kb] wrote ${outPath}`);
console.log(`[export-kb] entries=${doc.count} categories=${categories.length}`);
console.log(`[export-kb] status=${JSON.stringify(statusCounts)}`);
if (unknownCategories.size) {
  console.warn(`[export-kb] unknown categories: ${[...unknownCategories].join(", ")}`);
}
