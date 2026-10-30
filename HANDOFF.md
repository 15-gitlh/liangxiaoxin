# 新手交接：已完成（Vercel 上线）

> 后端最终没有走 EdgeOne，而是用 Vercel + 自定义域名上线。
>
> 当前正式地址：
>
> - 前端：https://15-gitlh.github.io/liangxiaoxin/
> - 后端：https://agent.liangxiaoxin.top
> - 健康检查：https://agent.liangxiaoxin.top/api/health
>
> 下面保留 EdgeOne 尝试记录，供以后参考。

---

## 一、现在是什么状态

| 项目 | 状态 |
|---|---|
| GitHub 仓库 | https://github.com/15-gitlh/liangxiaoxin |
| 前端 | https://15-gitlh.github.io/liangxiaoxin/ |
| 问答库 | https://15-gitlh.github.io/liangxiaoxin/faq.html |
| Supabase | `kb_chunks` 91 条，91 个 embedding |
| 后端 | Vercel：https://agent.liangxiaoxin.top |
| 自定义域名 | `agent.liangxiaoxin.top` |
| EdgeOne | 当前项目只支持静态页，未采用 |

---

## 二、你只需要做 4 件事

### 第 1 件：登录 EdgeOne

打开：

```text
https://console.cloud.tencent.com/edgeone/pages
```

用微信/QQ/腾讯云账号登录。

- 如果提示实名认证，按提示做
- EdgeOne Makers 免费版通常**不用绑卡**
- 如果它非要绑卡，先停，告诉我，换 Vercel / Hugging Face

### 第 2 件：导入 GitHub 仓库

1. 点 **新建项目**
2. 选 **导入 Git 仓库**
3. 如果第一次用，点 **授权 GitHub**
4. 选择仓库：

```text
15-gitlh/liangxiaoxin
```

5. 项目名可以填：

```text
liangxiaoxin-agent
```

6. 构建配置不用手填，仓库里有 `edgeone.json`：

```text
安装命令：npm install
构建命令：node build.mjs
输出目录：dist
Node 版本：20.18.0
函数目录：cloud-functions
```

> 如果控制台不自动读取，就按上面 5 行手动填。  
> **最容易漏的是“函数目录”：必须填 `cloud-functions`，否则页面能打开，但 `/api/health` 返回 404。**

7. 保存后重新部署一次。

### 第 3 件：填环境变量

在项目设置 → 环境变量，添加下面这些。

#### 公开配置（直接照抄）

```env
CORS_ORIGINS=https://15-gitlh.github.io
PGSSL=require
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EMBEDDING_MODEL=qwen3.7-text-embedding
EMBEDDING_DIM=1024
EMBEDDING_BATCH_SIZE=10
EMBEDDING_SEND_DIMENSIONS=true
HANDOFF_MIN_CONFIDENCE=0.45
```

#### 私密配置（从本机 `backend/.env` 复制）

| 变量名 | 去哪里复制 |
|---|---|
| `DATABASE_URL` | `backend/.env` 里的 `DATABASE_URL` |
| `LLM_API_KEY` | `backend/.env` 里的 `LLM_API_KEY` |
| `EMBEDDING_API_KEY` | `backend/.env` 里的 `EMBEDDING_API_KEY` |
| `ADMIN_TOKEN` | 随便设一个长字符串，例如 `liangxiaoxin-admin-2026-8f3k2m` |

> `DATABASE_URL` 建议把端口从 `5432` 改成 `6543`（Transaction pooler），Serverless 更稳。  
> 如果 6543 连不上，再换回 5432。

**不要把私密配置发到聊天里。**

### 第 4 件：点 Deploy

点 **部署 / Deploy**，等 1–3 分钟。

成功后控制台会给一个“项目域名/部署域名”，但注意：

> **中国大陆网络访问 EdgeOne 的项目域名，需要预览链接，有效期 3 小时。**  
> 过了时间会返回 `401 UNAUTHORIZED`，这是正常的。

### 只想先测试

项目概览 → 右上角 **预览** → 复制新链接（带 `eo_token`）→ 2 分钟内发我。

### 想长期给前端用

必须绑**自定义域名**：

1. 买一个便宜域名（腾讯云/阿里云，几十块一年）
2. EdgeOne 项目 → **域名管理 → 添加域名**
3. 填子域名，例如 `liangxiaoxin.你的域名.com`
4. 加速区域选 **全球可用区（不含中国大陆）**（不用备案）
5. 去 DNS 加 CNAME，等证书签发
6. 用这个自定义域名替换 `LXX_API_BASE`

**预览链接不能长期作为前端 API 地址**，因为会过期。

---

## 三、部署后验证

### 方法 A：浏览器

打开：

```text
https://你的EdgeOne域名/api/health
```

看到：

```json
{"ok":true,"service":"liangxiaoxin-agent"}
```

就说明后端活了。

### 方法 B：命令行

在项目目录执行：

```powershell
.\tools\node\node.exe backend\scripts\check-backend.mjs https://你的EdgeOne域名
```

看到：

```text
health: HTTP 200
chat: HTTP 200
answer: 宿舍门禁是晚上 22:30 关门……
citations: dorm-access(0.7563)
```

就说明 RAG 整条链路通了。

---

## 四、把前端切到 EdgeOne

拿到域名后，在项目目录执行一条命令：

```powershell
.\set-api-base.cmd "https://你的EdgeOne域名" -Publish
```

它会自动：

1. 改 `index.html` 的 `window.LXX_API_BASE`
2. commit
3. push
4. GitHub Pages 自动重新部署

等 1–2 分钟，打开：

```text
https://15-gitlh.github.io/liangxiaoxin/
```

问“宿舍门禁几点？”，如果出现“智能回答”卡片和引用，就完成了。

---

## 五、常见问题

### 1. `/api/health` 返回 404

- **项目设置 → Functions Directory 填 `cloud-functions`**（最常见原因）
- 确认仓库里有 `cloud-functions/api/health.js`、`chat.js`
- 确认 EdgeOne 项目的根目录是**仓库根目录**，不是 `backend`
- 重新部署一次
- 看 EdgeOne → Functions 里有没有 `api`

### 2. 构建失败：找不到 express

- 确认根目录 `package.json` 里有 `express / pg / openai / zod`
- 确认安装命令是 `npm install`
- 重新构建

### 3. 返回 503 `llm_not_configured`

- `LLM_API_KEY` 没填，或填错项目环境
- 补上后重新部署

### 4. 返回 503 `embedding_not_configured`

- `EMBEDDING_API_KEY` 没填
- 补上后重新部署

### 5. `DATABASE_URL_NOT_CONFIGURED`

- `DATABASE_URL` 没填
- 注意不要带引号，整串一行

### 6. 连接数据库超时

- 先用 6543
- 不行换 5432
- 再不行检查 Supabase 项目是否暂停

### 7. 浏览器报 CORS

- `CORS_ORIGINS` 里要有：

```text
https://15-gitlh.github.io
```

- 如果 EdgeOne 也托管前端，把 EdgeOne 域名也加进去，用逗号分隔

### 8. 页面还是旧版本

- GitHub Pages 有约 10 分钟缓存
- 等一会儿，或 `Ctrl + F5` 强刷

---

## 六、安全提醒

- 不要把 `backend/.env` 发聊天、发群、截图
- EdgeOne 环境变量只填在控制台
- 如果 Key 泄露，立刻去平台撤销重发
- 正式对外发布前，需要学校审核，不能冒充官方

---

## 七、如果 EdgeOne 项目不支持函数

按顺序换：

1. **Vercel Hobby**：GitHub 登录，通常不绑卡；代码已适配，见 [VERCEL.md](VERCEL.md)
2. **Hugging Face Spaces**：Docker，不绑卡；国内访问可能不稳
3. **Railway**：试用额度，可能不用立刻绑卡

告诉我你卡在哪一步，我继续改。
