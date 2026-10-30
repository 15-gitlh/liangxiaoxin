# Vercel 免费后端（不绑卡、不用域名）

> 适用：EdgeOne 项目不支持 Cloud Functions，或不想买域名。
>
> Vercel Hobby 免费版通常不绑卡，会给一个 `*.vercel.app` 子域名。

## 已准备好的代码

```text
backend/
├─ api/
│  ├─ chat.js        /api/chat
│  ├─ health.js      /api/health
│  └─ feedback.js    /api/feedback
├─ app.js            Express app
└─ vercel.json       函数超时配置
```

## 1. 导入项目

1. 打开 https://vercel.com/new
2. 用 GitHub 登录
3. 选择 **Import Git Repository**
4. 选 `15-gitlh/liangxiaoxin`
5. **Root Directory** 填：

```text
backend
```

6. Framework Preset 选：

```text
Other
```

7. Build Command 留空（Vercel 会自动 `npm install`）
8. Output Directory 留空

> 一定要把 Root Directory 改成 `backend`，不是仓库根目录。

## 2. 环境变量

在 Vercel 项目 → Settings → Environment Variables 添加：

```env
DATABASE_URL=postgresql://postgres.<ref>:<密码>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
PGSSL=require

LLM_API_KEY=你的DeepSeekKey
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat

EMBEDDING_API_KEY=你的DashScopeKey
EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EMBEDDING_MODEL=qwen3.7-text-embedding
EMBEDDING_DIM=1024
EMBEDDING_BATCH_SIZE=10
EMBEDDING_SEND_DIMENSIONS=true
HANDOFF_MIN_CONFIDENCE=0.45

CORS_ORIGINS=https://15-gitlh.github.io
ADMIN_TOKEN=换成长随机串
```

> Serverless 用 Supabase **Transaction pooler 6543**。  
> 如果 6543 报错，再换 Session pooler 5432。

## 3. 部署

点 **Deploy**，等 1–2 分钟。

得到：

```text
https://liangxiaoxin-agent-xxxx.vercel.app
```

先测：

```text
https://你的域名/api/health
```

应返回：

```json
{"ok":true,"service":"liangxiaoxin-agent"}
```

## 4. 切换前端

在项目目录执行：

```powershell
.\set-api-base.cmd "https://你的Vercel域名" -Publish
```

验证：

```powershell
.\tools\node\node.exe backend\scripts\check-backend.mjs https://你的Vercel域名
```

## 5. 域名审核通过后

你的 `.top` 域名审核通过后，也可以绑到 Vercel：

1. Vercel 项目 → Settings → Domains
2. 添加 `liangxiaoxin.你的域名.top`
3. 按 Vercel 提示去 DNSPod 加 CNAME
4. 等证书

这样就不需要 EdgeOne 了。

## 6. 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 404 | Root Directory 没设 `backend` | 项目设置改成 `backend`，重新部署 |
| `Cannot find package` | 依赖没装 | 确认 Root Directory 是 `backend` |
| 503 `llm_not_configured` | 环境变量缺失 | 补 `LLM_API_KEY` |
| 数据库连接超时 | 5432 连接数 | 改 6543 |
| CORS 报错 | 前端域名没放行 | `CORS_ORIGINS` 加 GitHub Pages |
| 函数超时 | 模型响应慢 | `backend/vercel.json` 已设 60 秒 |

## 7. 费用

Vercel Hobby：个人项目免费，通常不绑卡。  
如果注册时强制要卡，先停，告诉我换 Hugging Face Spaces。
