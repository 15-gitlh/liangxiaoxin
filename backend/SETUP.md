# 新手配置指南：Supabase + Qwen + DeepSeek

> 目标：把 `backend/.env` 填好，让建表和入库能跑通。
>
> **不要**把 `.env` 内容、数据库密码、API Key 发到聊天或截图里。

---

## 0. 你需要准备 3 个账号

| 账号 | 用途 | 网址 |
|---|---|---|
| Supabase | 托管 Postgres + pgvector | https://supabase.com |
| 阿里云百炼（DashScope） | Qwen embedding | https://bailian.console.aliyun.com |
| DeepSeek | 对话模型 | https://platform.deepseek.com |

---

## 1. 在 Supabase 建项目

1. 打开 https://supabase.com/dashboard 并登录。
2. 点 **New project**。
3. 填写：
   - Organization：默认即可
   - Project name：`liangxiaoxin`
   - Database Password：点 **Generate a password**，或自己设一个**只含字母数字**的密码
   - Region：选 **Southeast Asia (Singapore)**（离国内近）
   - Plan：Free
4. 点 **Create new project**，等 1–2 分钟。

> **数据库密码一定要保存**，后面连接串要用。  
> 忘了可以在 Project Settings → Database → Reset database password 重置。

---

## 2. 复制 Session pooler 连接串

1. 进入项目，点顶部 **Connect**。
2. 选 **Session pooler**（不是 Direct connection，也不是 Transaction pooler）。
3. 复制那串 URI，大概长这样：

```text
postgresql://postgres.abcdefghijklm:MyPass123@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

4. 检查：
   - 用户名是 `postgres.<project-ref>`
   - 主机是 `...pooler.supabase.com`
   - 端口是 **5432**
   - 密码位置填你第 1 步设的密码
   - 末尾加 `?sslmode=require`

最终应该是：

```text
postgresql://postgres.abcdefghijklm:MyPass123@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require
```

### 密码有特殊字符怎么办

如果密码里有 `@`、`#`、`/`、`:`，连接串会解析错。  
最省事：把数据库密码重置成**只含字母和数字**的密码。

---

## 3. 拿 Qwen（DashScope）Key

1. 打开 https://bailian.console.aliyun.com
2. 登录阿里云，完成实名认证（如果没做过）。
3. 左侧找 **API-KEY** 或 **API Key 管理**。
4. 点 **创建我的 API-KEY**。
5. 复制 `sk-...` 开头的 Key。

> 如果提示模型未开通，去“模型广场”搜索 `qwen3.7-text-embedding`（或 `text-embedding-v4`）并开通。  
> 新账号一般有免费额度，够 91 条入库和测试。

---

## 4. 拿 DeepSeek Key

1. 打开 https://platform.deepseek.com
2. 登录后点 **API keys**。
3. 点 **Create new API key**，复制 `sk-...`。
4. 确认账户有余额；没有就充一点（几块钱就够测试）。

---

## 5. 创建 `backend/.env`

### 方法 A：文件资源管理器（推荐新手）

1. 打开文件夹：

```text
C:\Users\11390\Documents\deepseek-harness\default-workspace\liangxiaoxin\backend
```

2. 如果看不到 `.env.example`：
   - 点资源管理器顶部 **查看**
   - 勾选 **文件扩展名** 和 **隐藏的项目**
3. 右键 `.env.example` → **复制** → **粘贴**
4. 把新文件重命名为：

```text
.env
```

> 注意：文件名就是 `.env`，不是 `.env.txt`。  
> 如果 Windows 提示“改变文件扩展名可能导致文件不可用”，点“是”。

### 方法 B：PowerShell

打开 PowerShell，执行：

```powershell
cd C:\Users\11390\Documents\deepseek-harness\default-workspace\liangxiaoxin\backend
Copy-Item .env.example .env
notepad .env
```

---

## 6. 填写 `.env`

用记事本打开 `.env`，按下面填（**不要加引号**，等号两边不要空格）：

```env
PORT=8080
CORS_ORIGINS=https://15-gitlh.github.io,http://localhost:8787,http://127.0.0.1:8787

# Supabase Session pooler
DATABASE_URL=postgresql://postgres.abcdefghijklm:MyPass123@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require
PGSSL=require

# DeepSeek
LLM_API_KEY=sk-你的DeepSeekKey
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat

# Qwen embedding
EMBEDDING_API_KEY=sk-你的DashScopeKey
EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EMBEDDING_MODEL=qwen3.7-text-embedding
EMBEDDING_DIM=1024
EMBEDDING_BATCH_SIZE=10
EMBEDDING_SEND_DIMENSIONS=true

# 管理接口令牌，随便设一个长字符串
ADMIN_TOKEN=liangxiaoxin-admin-2026
```

### 最常见的 5 个错误

| 错误写法 | 正确写法 |
|---|---|
| `DATABASE_URL = "postgresql://..."` | `DATABASE_URL=postgresql://...` |
| 密码里有 `@` 没转义 | 改成纯字母数字密码 |
| 用了 Direct connection | 用 **Session pooler** |
| 端口写成 6543 | Session pooler 用 **5432** |
| 末尾没有 `?sslmode=require` | 加上 |

---

## 7. 保存后检查

在 PowerShell 里执行：

```powershell
cd C:\Users\11390\Documents\deepseek-harness\default-workspace\liangxiaoxin\backend
Get-Content .env | ForEach-Object { ($_ -split '=')[0] }
```

只会显示“键名”，不会显示值。确认有：

```text
PORT
CORS_ORIGINS
DATABASE_URL
PGSSL
LLM_API_KEY
LLM_BASE_URL
LLM_MODEL
EMBEDDING_API_KEY
EMBEDDING_BASE_URL
EMBEDDING_MODEL
EMBEDDING_DIM
ADMIN_TOKEN
```

---

## 8. 运行建表和入库

```powershell
cd C:\Users\11390\Documents\deepseek-harness\default-workspace\liangxiaoxin\backend
npm run db:init
npm run ingest
```

预期：

```text
[db:init] ok, kb_chunks count=0
[ingest] written=91
[ingest] db count=91 embedded=91
```

> 本机 `npm` 不在 PATH 时，用便携版：
>
> ```powershell
> ..\tools\node\npm.cmd run db:init
> ..\tools\node\npm.cmd run ingest
> ```

---

## 9. 启动后端测试

```powershell
npm run dev
```

另开一个 PowerShell：

```powershell
curl http://localhost:8080/health

curl -X POST http://localhost:8080/api/chat `
  -H "Content-Type: application/json" `
  -d '{"message":"宿舍门禁几点？"}'
```

如果返回 `answer` + `citations`，说明整条链路通了。

---

## 10. 常见报错

| 报错 | 原因 | 处理 |
|---|---|---|
| `password authentication failed` | 数据库密码错 / 特殊字符没转义 | 重置成纯字母数字密码 |
| `getaddrinfo ENOTFOUND` | 主机名错 / 用了 Direct connection | 用 Session pooler 连接串 |
| `connection timeout` | 网络 / 端口错 / IPv6 | 用 Session pooler 5432 |
| `type "vector" does not exist` | 没建扩展 | 先跑 `npm run db:init` |
| `relation "kb_chunks" does not exist` | 没建表 | 先跑 `npm run db:init` |
| `401 invalid_api_key` | Key 错 / Base URL 错 | 检查两家的 Key 和 URL |
| `dimensions` 参数错误 | 供应商不支持 | `.env` 加 `EMBEDDING_SEND_DIMENSIONS=false` |
| `embedding 维度不匹配` | 模型维度不是 1024 | 改 `EMBEDDING_DIM` 或换模型 |
| `LLM_NOT_CONFIGURED` | DeepSeek Key 没填 | 填 `LLM_API_KEY` |

---

## 11. 安全提醒

- `.env` 已在 `.gitignore` 里，不会被推到 GitHub。
- 不要把 `.env` 截图发群/聊天。
- Key 泄露了立刻去平台撤销并重新生成。
- Supabase 免费项目长时间不用会暂停，进 Dashboard 点 Restore 即可。

---

填好后跟量小新说“`.env` 填好了”，我这边直接跑 `db:init` 和 `ingest`，不用你敲命令。
