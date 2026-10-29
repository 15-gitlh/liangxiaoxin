# 量小新 Agent 后端（Step 1）

## 为什么选 Node + Express

现有前端是原生 HTML/CSS/JS，仓库已有 `package.json` 和 Node 版 `server.mjs`，继续用 Node 最省事：同一套语言、同一个仓库、Render/Railway 都能直接跑。

## 向量库推荐：pgvector

轻量部署优先 **pgvector**：

- 只要一个托管 Postgres（Neon / Supabase / Railway），不用再开一个向量服务
- SQL + 事务 + 备份，运营和排错简单
- 91 条到几万条知识片段完全够用
- Render/Railway 的本地磁盘是临时的，Qdrant 单独跑要挂持久卷；pgvector 用托管库更稳

什么时候换 Qdrant：向量到百万级、QPS 很高、需要复杂向量过滤时。  
Milvus Lite 更偏 Python 嵌入式，不适合当前 Node 后端。

## API

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/` | 服务信息 |
| GET | `/health` | 健康检查（Render/Railway 用） |
| POST | `/api/chat` | 问答（Step 2 接 RAG） |
| POST | `/api/feedback` | 👍/👎 反馈 |
| POST | `/api/admin/reindex` | 重建索引（Step 2，需 Bearer Token） |

### POST /api/chat

请求：

```json
{
  "message": "宿舍门禁几点？",
  "sessionId": "optional-uuid",
  "history": [
    { "role": "user", "content": "宿舍怎么分？" },
    { "role": "assistant", "content": "..." }
  ]
}
```

响应（RAG 已接入）：

```json
{
  "requestId": "uuid",
  "sessionId": "optional-uuid",
  "answer": "宿舍 22:30 关门，周日至周四 23:00 熄灯……[1]",
  "citations": [
    {
      "id": "dorm-access",
      "chunkId": "faq:dorm-access",
      "title": "宿舍门禁/熄灯/晚归怎么规定？",
      "category": "宿舍生活",
      "source": "《中国计量大学学生手册（2026）》第172页",
      "sourcePage": "172",
      "updated": "2026-10-28",
      "score": 0.82
    }
  ],
  "confidence": 0.82,
  "handoff": false,
  "latencyMs": 1200
}
```

- `citations`：命中的知识条目（标题/来源/页码/score）
- `confidence`：最高检索相似度，不是模型自评
- `handoff`：没检索到就 `true`，前端可引导转人工

## 已生成 kb.json

`backend/data/kb.json` 已从根目录 `kb.js` 转出：

- 91 条
- 8 类
- `official=39 / general=40 / pending=12`
- 每条带 `chunkId`、`sourcePage`、`searchText`、`content`、`contentHash`

重新生成：

```bash
cd backend
npm run export:kb
```

字段说明见 [data/README.md](data/README.md)。

## RAG 代码结构

```text
src/
├─ db.js         pg Pool + search_path(public, extensions)
├─ embedding.js  Qwen qwen3.7-text-embedding 查询向量
├─ retrieve.js   pgvector top-k + 关键词兜底
├─ prompt.js     系统提示词 + 资料编号 + 最近 6 轮历史
├─ llm.js        DeepSeek chat（OpenAI 兼容）
└─ agent.js      检索 -> Prompt -> 生成 -> citations/handoff
```

`/api/chat` 流程：

```text
message
  -> embedQuery
  -> pgvector cosine top 5
  -> 最高分 < RETRIEVAL_MIN_SCORE ? 关键词兜底
  -> buildMessages(资料 + 历史)
  -> DeepSeek
  -> answer + citations + confidence + handoff
```

可调环境变量：

```env
RETRIEVAL_TOP_K=5
RETRIEVAL_MIN_SCORE=0.35
```

## Step 2：Supabase 入库

### 1. 建表

填好 `.env` 后，一条命令建表：

```bash
cd backend
npm run db:init
```

也可以把 `backend/db/schema.sql` 贴到 Supabase SQL Editor 执行。它会：

- 启用 `vector` 扩展
- 建 `public.kb_chunks`
- 建分类/内容哈希索引
- 建 HNSW 向量索引（cosine）
- 开启 RLS（后端用 postgres 连接串访问）

### 2. 填环境变量

复制 `backend/.env.example` 为 `backend/.env`，填：

```env
DATABASE_URL=postgresql://postgres.<project-ref>:password@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
EMBEDDING_API_KEY=你的 DashScope Key
```

> Supabase 用 **Session pooler** 的连接串（IPv4，端口 5432）。不要用直连地址，Render/Railway 不一定有 IPv6。

### 3. 入库

```bash
cd backend
npm install
npm run ingest
```

预期输出：

```text
[ingest] kb.json entries=91 ...
[ingest] 10/91
...
[ingest] written=91
[ingest] db count=91 embedded=91
```

脚本按 `chunk_id` upsert，可以重复跑；改完 `kb.js` 后：

```bash
npm run export:kb
npm run ingest
```

### 4. 验证

Supabase SQL Editor：

```sql
select count(*) as total, count(embedding) as embedded
from public.kb_chunks;
```

应该都是 91。

如果 Qwen 报 `dimensions` 参数错误，在 `.env` 加：

```env
EMBEDDING_SEND_DIMENSIONS=false
```

## 本地运行

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

测试：

```bash
curl http://localhost:8080/health

curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"宿舍门禁几点？"}'
```

## 环境变量

| 变量 | 说明 |
|---|---|
| `PORT` | 默认 8080 |
| `CORS_ORIGINS` | 允许的前端 Origin，逗号分隔 |
| `DATABASE_URL` | pgvector Postgres 连接串 |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | 对话模型 |
| `EMBEDDING_API_KEY` / `EMBEDDING_BASE_URL` / `EMBEDDING_MODEL` / `EMBEDDING_DIM` | 向量模型 |
| `ADMIN_TOKEN` | 保护重建索引接口 |

## 已完成（Step 2）

1. `data/kb.json`：91 条结构化知识
2. `scripts/ingest.mjs`：Qwen embedding + pgvector upsert
3. `src/retrieve.js`：pgvector top-k + 关键词兜底
4. `src/prompt.js`：系统提示词 + 资料编号 + 历史
5. `src/agent.js`：检索 → Prompt → DeepSeek → citations
6. `/api/chat` 已从占位改为真实 RAG

## 下一步（Step 3）

1. `POST /api/chat/stream`：SSE 流式输出
2. 前端 `app.js` 接后端 + 流式渲染 + 引用卡片
3. CORS 生产环境只保留 GitHub Pages 域名
4. `POST /api/admin/reindex`：上传文档后重建索引
