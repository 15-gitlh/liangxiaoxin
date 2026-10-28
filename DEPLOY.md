# 量小新 · 上线说明

## 当前临时公网地址

```
https://6b27d14eaf4a40.lhr.life/
```

- 由 `localhost.run` SSH 隧道提供，HTTPS，手机/外网可直接打开。
- **临时地址**：电脑关机、休眠、断网、Node 服务停止或 SSH 隧道断开后会失效；重启隧道地址会变。
- 问答库：`https://6b27d14eaf4a40.lhr.life/faq.html`

同 Wi-Fi 局域网地址：

```
http://10.5.115.162:8787/
```

需要 Windows 防火墙允许 Node.js；不同 Wi-Fi/AP 隔离时不可用。

---

## 永久上线：静态托管

这个项目没有框架构建，但部署前会用 `build.mjs` 把公开文件复制到 `dist/`：

```bash
node build.mjs
```

`dist/` 里是这 9 个文件：

```
index.html
faq.html
styles.css
faq.css
app.js
faq.js
kb.js
robots.txt
_headers
```

`server.mjs`、`package.json`、`inbox/`、截图、`tools/` 都不进 `dist/`，不会被公开访问。

### 方案 A：Cloudflare Pages（推荐，免费 HTTPS）

**Git 连接（推荐，能自动更新）**

1. 登录 https://dash.cloudflare.com/
2. Workers & Pages → Create → Pages → Connect to Git
3. 选仓库，Build command 填 `node build.mjs`，Output directory 填 `dist`
4. Deploy，得到 `*.pages.dev`
5. 绑定自定义域名

**直接上传（不会自动更新）**

1. 本地执行 `node build.mjs`
2. Workers & Pages → Create → Pages → Upload assets
3. 把 `dist/` 文件夹拖进去

### 方案 B：Netlify（仓库已带 `netlify.toml`）

**Git 连接（推荐，能自动更新）**

1. 登录 https://app.netlify.com/
2. Add new site → Import an existing project → 选 GitHub 仓库
3. Netlify 会自动读取 `netlify.toml`（`node build.mjs` + `dist`）
4. Deploy

**拖拽上传（不会自动更新）**

1. 本地执行 `node build.mjs`
2. 打开 https://app.netlify.com/drop
3. 把 `dist/` 文件夹拖进去

### 方案 C：Vercel（仓库已带 `vercel.json`）

```bash
npx vercel --prod
```

按提示登录，项目根目录选 `liangxiaoxin`；`vercel.json` 已指定 `node build.mjs` 和 `dist`。

### 方案 D：GitHub Pages

仓库已带 `.github/workflows/pages.yml`：

1. 推送到 GitHub 的 `main`
2. 仓库 Settings → Pages → Build and deployment → Source 选 **GitHub Actions**
3. 每次 push 自动部署，地址 `https://<用户名>.github.io/<仓库名>/`

---

## 自动更新怎么开

只要用 **Git 连接**（Netlify / Cloudflare Pages / GitHub Pages），以后改完执行：

```bash
git add .
git commit -m "更新知识库"
git push
```

平台会自动重新构建、发布。只改本地不 push，线上不会变。

如果用的是拖拽上传，改完要重新 `node build.mjs` 再拖一次 `dist/`。

---

## 可选：接大模型

`server.mjs` 提供 `/api/chat` 代理，静态托管不会运行 Node。

如果要接大模型：

1. 把 `server.mjs` 部署到 Render / Railway / Fly.io 等支持 Node 的平台；
2. 配置环境变量 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`；
3. 修改前端请求地址（当前是 same-origin `/api/chat`），或给静态站配反向代理；
4. 在 `index.html` 打开 `window.LXX_LLM_ENABLED = true`。

不接大模型时，前端会自动回退到本地 `kb.js`，功能不受影响。

---

## 正式发布前必须确认

- **学校授权/审核**：这是“中国计量大学”名称的演示原型，正式对外发布前需学工部/招生办/宣传部审核，不能冒充官方。
- **ICP 备案**：如果使用中国大陆服务器/域名对外提供网站服务，通常需要 ICP 备案；海外托管（Cloudflare/Netlify/Vercel）不走大陆备案，但访问速度和合规性要自行评估。
- **隐私与日志**：当前反馈/日志存在浏览器 `localStorage`，没有上传服务器；如果接后端，需要隐私政策。
- **内容时效**：手册、缴费、门禁等政策会变，页面已标“演示原型/以学校官方发布为准”。
