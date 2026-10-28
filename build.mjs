import { cpSync, mkdirSync, rmSync } from "node:fs";

const files = [
  "index.html",
  "faq.html",
  "styles.css",
  "faq.css",
  "app.js",
  "faq.js",
  "kb.js",
  "robots.txt",
  "_headers"
];

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

for (const file of files) {
  cpSync(file, `dist/${file}`);
}

console.log(`dist ready: ${files.length} files`);
