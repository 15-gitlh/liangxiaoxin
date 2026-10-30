# EdgeOne Makers 部署（不绑卡方案）

> 适合：不想在 Render 绑卡，但需要一个稳定的公网后端。
>
> EdgeOne Makers 是腾讯云的产品，免费版通常不需要绑卡，但需要腾讯云账号/实名认证。

## 已准备好的结构

```text
edgeone.json                          # 构建命令 + 输出目录
cloud-functions/
└─ api/
   └─ [[default]].js                  # EdgeOne Cloud Function，转发给 Express
backend/
├─ app.js                             # Express app（不监听端口）
└─ server.js                          # 本地监听入口
```

- `cloud-functions/api/[[default]].js` 会把 `/chat` 补成 `/api/chat`，兼容 EdgeOne 的前缀剥离
- 前端仍然可以放 GitHub Pages，也可以由 EdgeOne 一起托管
- 后端依赖已加到根 `package.json`，EdgeOne 构建时会安装

## 1. 导入仓库

1. 打开 EdgeOne Makers 控制台：https://console.cloud.tencent.com/edgeone/pages
2. 新建项目 → **导入 Git 仓库**
3. 选择 `15-gitlh/liangxiaoxin`
4. 构建配置会读取根目录 `edgeone.json`：
   - build：`node build.mjs`
   - output：`./dist`
   - node：`20.18.0`

## 2. 配置环境变量

在项目设置里加：

```env
DATABASE_URL=postgresql://postgres.<ref>:<密码>@aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require
PGSSL=require

LLM_API_KEY=sk-你的DeepSeekKey
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat

EMBEDDING_API_KEY=sk-你的DashScopeKey
EMBEDDING_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EMBEDDING_MODEL=qwen3.7-text-embedding
EMBEDDING_DIM=1024
EMBEDDING_BATCH_SIZE=10
EMBEDDING_SEND_DIMENSIONS=true
HANDOFF_MIN_CONFIDENCE=0.45

CORS_ORIGINS=https://15-gitlh.github.io
ADMIN_TOKEN=换成长随机串
```

> Serverless 建议 Supabase 用 **Transaction pooler 6543**；本地/常驻服务用 Session pooler 5432。

## 3. 部署

点 Deploy，得到 EdgeOne 默认域名，例如：

```text
https://liangxiaoxin-xxxx.edgeone.app
```

先测：

```text
https://你的域名/api/health
```

应该返回：

```json
{"ok":true,"service":"liangxiaoxin-agent"}
```

再测：

```bash
curl -X POST https://你的域名/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"宿舍门禁几点？"}'
```

## 3.5 为什么预览链接会 401

EdgeOne Makers 有三种域名：

| 类型 | 特点 | 大陆访问 |
|---|---|---|
| 项目域名 | 固定，始终指向最新部署 | **需要预览链接，有效期 3 小时** |
| 部署域名 | 每次部署一个，保留旧版本 | 同上 |
| 自定义域名 | 稳定，可长期用 | 全球（不含大陆）无需备案；大陆/全球需要 ICP |

所以：

- 你发的 `?eo_token=...` 链接是**预览链接**，过期就 401
- 项目域名在**中国大陆网络**下也需要预览链接
- 要稳定给前端用，必须绑**自定义域名**

### 没有自定义域名怎么办

1. 买一个便宜域名（腾讯云 DNSPod / 阿里云，`.top`/`.xyz` 几十块一年）
2. EdgeOne 项目 → **域名管理 → 添加域名**
3. 填一个子域名，例如：

```text
liangxiaoxin.你的域名.com
```

4. 加速区域选 **全球可用区（不含中国大陆）**（不用备案）
5. 按提示去 DNS 添加 CNAME 记录
6. 等 5–30 分钟，证书自动签发
7. 用这个域名替换下面的 `https://你的EdgeOne域名`

> 如果暂时不买域名：先用「项目概览 → 右上角 预览」生成 3 小时链接做测试，但不能长期给前端用。

## 4. 前端指向 EdgeOne

拿到 EdgeOne 默认域名后，在项目目录执行一条命令：

```powershell
.\set-api-base.cmd "https://你的EdgeOne域名" -Publish
```

它会：

- 把 `index.html` 的 `window.LXX_API_BASE` 改成 EdgeOne 域名
- 自动 commit + push
- GitHub Pages 随后自动部署

> 不要加 `/api`，前端会自动请求 `/api/chat`。

如果不想用脚本，手动改 `index.html`：

```html
window.LXX_API_BASE = "https://你的域名";
```

然后执行：

```powershell
.\publish.cmd "切换到 EdgeOne 后端"
```

## 5. 一键验证后端

在项目目录执行：

```powershell
.\tools\node\node.exe backend\scripts\check-backend.mjs https://你的EdgeOne域名
```

预期：

```text
health: HTTP 200
{"ok":true,"service":"liangxiaoxin-agent"}

chat: HTTP 200
answer: 宿舍门禁是晚上 22:30 关门……
citations: dorm-access(0.7563)
```

## 6. 常见错误

| 现象 | 原因 | 处理 |
|---|---|---|
| `/api/health` 404 | 函数没识别到 | 确认 `cloud-functions/api/[[default]].js` 已推送，重新部署 |
| `Cannot find package 'express'` | 根依赖没装 | 确认根 `package.json` 有 express/pg/openai 等，重新构建 |
| 503 `llm_not_configured` | 环境变量没填 | EdgeOne 项目设置里补 `LLM_API_KEY` |
| 503 `embedding_not_configured` | 环境变量没填 | 补 `EMBEDDING_API_KEY` |
| `DATABASE_URL_NOT_CONFIGURED` | 没配数据库 | 补 `DATABASE_URL` |
| 连接超时 | 端口/网络 | Serverless 先用 6543；不行换 5432 |
| CORS 报错 | 前端域名没放行 | `CORS_ORIGINS` 加 GitHub Pages 或 EdgeOne 域名 |
| 函数 500 | 看日志 | EdgeOne 控制台 → Functions → 日志 |

## 7. 我不能替你做的部分

EdgeOne 控制台必须登录**你的腾讯云账号**，我这边不能代登录，所以这几步只能你点：

1. 登录腾讯云
2. 导入 GitHub 仓库
3. 填环境变量
4. 点 Deploy

其余代码、配置、构建、验证脚本，我都已经写好。

## 8. 免费额度

EdgeOne Makers 免费版有函数调用/流量/构建配额，具体以控制台「限制与配额」为准。  
校园演示通常够用；正式给全校用再升级或换学校服务器。

## 和 Render 的区别

| 项 | Render | EdgeOne Makers |
|---|---|---|
| 绑卡 | Blueprint 可能要 | 通常不用 |
| 国内访问 | 一般 | 腾讯云节点，通常更好 |
| 部署 | `render.yaml` | `edgeone.json` + `cloud-functions` |
| 函数模型 | 常驻 Node 服务 | Cloud Functions |
| 免费休眠 | 会 | 以套餐为准 |
