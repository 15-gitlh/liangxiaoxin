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

这个项目是纯静态站，不需要构建。需要上传的文件：

```
index.html
faq.html
styles.css
faq.css
app.js
faq.js
kb.js
```

`server.mjs`、`package.json` 只在本地起服务/接大模型时需要，静态托管不用上传。

### 方案 A：Cloudflare Pages（推荐，免费 HTTPS）

1. 登录 https://dash.cloudflare.com/
2. Workers & Pages → Create → Pages → Upload assets
3. 把上面 7 个文件拖进去
4. Deploy，得到 `*.pages.dev` 域名
5. 需要自定义域名时，在 Pages 项目里绑域名

### 方案 B：Netlify Drop

1. 打开 https://app.netlify.com/drop
2. 把 7 个文件所在文件夹拖进去
3. 登录后保留站点，得到 `*.netlify.app`

### 方案 C：Vercel

```bash
npx vercel --prod
```

按提示登录，项目根目录选 `liangxiaoxin`。

### 方案 D：GitHub Pages

1. 新建仓库，上传 7 个文件
2. Settings → Pages → Deploy from a branch → `main` / root
3. 得到 `https://<用户名>.github.io/<仓库名>/`

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
