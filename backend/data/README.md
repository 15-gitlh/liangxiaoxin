# kb.json 字段说明

由 `backend/scripts/export-kb.mjs` 从根目录 `kb.js` 生成。

重新生成：

```bash
cd backend
npm run export:kb
```

## 顶层

| 字段 | 说明 |
|---|---|
| `schemaVersion` | 当前 `1.0` |
| `generatedAt` | 生成时间 |
| `generatedFrom` | 固定 `kb.js` |
| `count` | 条目数（当前 91） |
| `categoryOrder` | 分类展示顺序 |
| `categories` | 分类及数量 |
| `statusCounts` | `official / general / pending` 数量 |
| `entries` | 知识条目数组 |

## 单条 entry

| 字段 | 用途 |
|---|---|
| `id` | 稳定 ID，前端/反馈/引用都用它 |
| `docType` | 固定 `faq` |
| `chunkId` | RAG 块 ID，`faq:<id>` |
| `category` | 分类 |
| `title` | 问题标题 |
| `aliases` | 同义问法，关键词兜底用 |
| `keywords` | 关键词，关键词检索/重排用 |
| `status` | `official / general / pending` |
| `answer` | 答案正文 |
| `steps` | 步骤数组 |
| `followups` | 追问建议 |
| `source` | 来源文字 |
| `sourceUrl` | 来源链接 |
| `sourcePage` | 从来源解析出的页码，如 `172` / `34-35`；没有则空 |
| `updated` | 内容更新时间 |
| `lang` | `zh-CN` |
| `searchText` | 标题+别名+关键词+答案+步骤，关键词检索用 |
| `content` | 给 embedding 的文本，含标题/分类/答案/步骤/来源 |
| `contentHash` | `content` 的 sha256 前 16 位，用于增量重建索引 |

## 入库

实际建表 SQL 见 [../db/schema.sql](../db/schema.sql)，包含：

- `vector` 扩展
- `public.kb_chunks`
- 分类 / `content_hash` 索引
- HNSW `vector_cosine_ops` 索引
- RLS

入库脚本：[../scripts/ingest.mjs](../scripts/ingest.mjs)，执行：

```bash
cd backend
npm run ingest
```

> `vector(1024)` 对应 Qwen `qwen3.7-text-embedding` 的 1024 维；换模型时改 SQL 列维度和 `EMBEDDING_DIM`。
