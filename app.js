/* 量小新 · 前端逻辑（无框架，直接打开即可运行） */
(() => {
  "use strict";

  const KB = Array.isArray(window.LXX_KB) ? window.LXX_KB : [];
  const $ = (sel, root = document) => root.querySelector(sel);

  const chat = $("#chat");
  const input = $("#input");
  const composer = $("#composer");
  const cats = $("#cats");
  const modalRoot = $("#modalRoot");
  const toastEl = $("#toast");
  const humanBtn = $("#humanBtn");
  const adminBtn = $("#adminBtn");
  const micBtn = $("#micBtn");

  const CAT_ORDER = ["报到", "缴费奖助", "宿舍生活", "校区交通", "学习教务", "军训体检", "安全防骗", "家长/心理"];
  const STATUS = {
    official: { label: "官方口径", cls: "official" },
    general: { label: "通用指引", cls: "general" },
    pending: { label: "待官方确认", cls: "pending" }
  };
  const LS_LOG = "lxx_log_v1";
  const LS_FB = "lxx_fb_v1";
  const state = { lastCategory: null, lastEntryId: null, lastQuestion: "", activeCat: "全部" };

  /* ---------------- utils ---------------- */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/啥/g, "什么")
      .replace(/咋/g, "怎么")
      .replace(/缴/g, "交")
      .replace(/[^\u4e00-\u9fa5a-z0-9]/g, "");
  }

  function bigrams(s) {
    const out = [];
    for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
  }

  function escapeHTML(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function safeText(s) {
    return String(s || "")
      .replace(/1[3-9]\d{9}/g, "[手机号]")
      .replace(/\b\d{17}[\dXx]\b/g, "[证件号]")
      .slice(0, 160);
  }

  function readStore(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }

  function logEvent(ev) {
    const arr = readStore(LS_LOG, []);
    arr.push(Object.assign({}, ev, { ts: Date.now() }));
    writeStore(LS_LOG, arr.slice(-600));
  }

  function recordFeedback(entryId, value) {
    const arr = readStore(LS_FB, []);
    arr.push({ entryId, value, ts: Date.now() });
    writeStore(LS_FB, arr.slice(-500));
  }

  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1900);
  }

  /* ---------------- retrieval ---------------- */
  function score(q, e) {
    const nq = norm(q);
    if (!nq) return 0;
    const nt = norm(e.title);
    let s = 0;

    if (nt === nq) s += 12;
    else if (nt.includes(nq) || nq.includes(nt)) s += 7;

    for (const a of e.aliases || []) {
      const na = norm(a);
      if (!na) continue;
      if (na === nq) s += 8;
      else if (nq.includes(na) || na.includes(nq)) s += 4;
    }

    for (const k of e.keywords || []) {
      const nk = norm(k);
      if (nk && nq.includes(nk)) s += 2;
    }

    const qb = new Set(bigrams(nq));
    const eb = new Set(bigrams(nt + (e.keywords || []).join("")));
    let overlap = 0;
    qb.forEach((b) => { if (eb.has(b)) overlap++; });
    s += Math.min(overlap, 8) * 0.45;

    return s;
  }

  function exactMatches(q) {
    const nq = norm(q);
    if (nq.length < 2) return [];
    return KB.filter((e) => {
      if (norm(e.title) === nq) return true;
      return (e.aliases || []).some((a) => norm(a) === nq);
    });
  }

  function related(q, n = 3) {
    const scored = KB.map((e) => ({ e, s: score(q, e) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);

    const seen = new Set();
    const out = [];
    for (const x of scored) {
      if (seen.has(x.e.category)) continue;
      seen.add(x.e.category);
      out.push(x.e);
      if (out.length >= n) break;
    }
    if (out.length < n) {
      for (const x of scored) {
        if (out.includes(x.e)) continue;
        out.push(x.e);
        if (out.length >= n) break;
      }
    }
    return out;
  }

  function answer(q) {
    const nq = norm(q);
    if (!nq) return { type: "empty" };

    if (/^(你好|您好|hi|hello|在吗|你是谁|你叫什么|介绍一下|你能做什么)/.test(nq)) {
      return { type: "intro" };
    }
    if (/(谢谢|感谢|辛苦)/.test(nq)) {
      return { type: "thanks" };
    }
    if (/(转人工|人工|客服|找老师|联系电话)/.test(nq)) {
      return { type: "human" };
    }

    const exact = exactMatches(q);
    if (exact.length === 1) return { type: "entry", entry: exact[0] };
    if (exact.length > 1) {
      return { type: "choices", entries: exact.slice(0, 8), title: "你是想问哪一个？" };
    }

    const scored = KB.map((e) => ({ e, s: score(q, e) })).sort((a, b) => b.s - a.s);
    if (scored[0] && scored[0].s >= 6) return { type: "entry", entry: scored[0].e };

    if (state.lastCategory) {
      const sub = KB.filter((e) => e.category === state.lastCategory)
        .map((e) => ({ e, s: score(q, e) }))
        .sort((a, b) => b.s - a.s);
      if (sub[0] && sub[0].s >= 3) return { type: "entry", entry: sub[0].e };
    }

    return { type: "fallback", related: related(q) };
  }

  /* ---------------- rendering ---------------- */
  function scroll() {
    requestAnimationFrame(() => { chat.scrollTop = chat.scrollHeight; });
  }

  function addUser(text) {
    const row = document.createElement("div");
    row.className = "msg user";
    row.innerHTML = '<div class="avatar">我</div><div class="stack"><div class="bubble"></div></div>';
    row.querySelector(".bubble").textContent = text;
    chat.appendChild(row);
    scroll();
  }

  function addBot(node) {
    const row = document.createElement("div");
    row.className = "msg bot";
    row.innerHTML = '<div class="avatar">量</div><div class="stack"></div>';
    row.querySelector(".stack").appendChild(node);
    chat.appendChild(row);
    scroll();
    return row;
  }

  function showTyping() {
    const row = document.createElement("div");
    row.className = "msg bot";
    row.innerHTML = '<div class="avatar">量</div><div class="stack"><div class="bubble typing"><i></i><i></i><i></i></div></div>';
    chat.appendChild(row);
    scroll();
    return row;
  }

  function renderWelcome() {
    const card = document.createElement("div");
    card.className = "welcome";
    card.innerHTML = [
      '<div class="eyebrow">CJLU · FRESHMAN GUIDE</div>',
      '<h2>你好，我是量小新</h2>',
      '<p>中国计量大学的新生助手。报到、宿舍、缴费、军训、校园地图，都可以问我。答不准的，我帮你转人工。</p>',
      '<div class="meta"><span class="pill">' + KB.length + ' 条知识库</span><span class="pill">7×24 在线</span><span class="pill">答案带来源</span></div>',
      '<div class="quick-grid"></div>',
      '<div class="fine">演示版 · 日期/金额/分配规则以学校官方发布为准</div>'
    ].join("");

    const questions = [
      "报到要带什么材料？",
      "宿舍怎么分？怎么查？",
      "学费多少？怎么缴？",
      "军训多久？要准备什么？",
      "校园地图/VR 全景有吗？",
      "新生防诈骗要注意什么？"
    ];
    const grid = card.querySelector(".quick-grid");
    questions.forEach((q) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quick";
      btn.innerHTML = '<span class="arrow">›</span><span class="qtext"></span>';
      btn.querySelector(".qtext").textContent = q;
      btn.addEventListener("click", () => handleSend(q));
      grid.appendChild(btn);
    });

    const row = addBot(card);
    row.dataset.welcome = "1";
  }

  function renderAnswer(entry) {
    const st = STATUS[entry.status] || STATUS.general;
    const card = document.createElement("div");
    card.className = "bubble answer";

    const head = document.createElement("div");
    head.className = "answer-head";
    const title = document.createElement("h3");
    title.className = "answer-title";
    title.textContent = entry.title;
    const badge = document.createElement("span");
    badge.className = "status " + st.cls;
    badge.textContent = st.label;
    head.append(title, badge);
    card.appendChild(head);

    const body = document.createElement("div");
    String(entry.answer || "").split("\n").filter(Boolean).forEach((t) => {
      const p = document.createElement("p");
      p.textContent = t;
      body.appendChild(p);
    });
    card.appendChild(body);

    if (Array.isArray(entry.steps) && entry.steps.length) {
      const ol = document.createElement("ol");
      ol.className = "steps";
      entry.steps.forEach((t) => {
        const li = document.createElement("li");
        li.textContent = t;
        ol.appendChild(li);
      });
      card.appendChild(ol);
    }

    const source = document.createElement("div");
    source.className = "source";
    source.appendChild(document.createTextNode("来源："));
    if (entry.sourceUrl) {
      const a = document.createElement("a");
      a.href = entry.sourceUrl;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = entry.source || "学校官网";
      source.appendChild(a);
    } else {
      source.appendChild(document.createTextNode(entry.source || "学校官网"));
    }
    source.appendChild(document.createTextNode(" · 更新 " + (entry.updated || "—")));
    card.appendChild(source);

    const actions = document.createElement("div");
    actions.className = "answer-actions";

    if (Array.isArray(entry.followups) && entry.followups.length) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "mini";
      more.textContent = "还有问题";
      more.addEventListener("click", () => {
        const chips = document.createElement("div");
        chips.className = "chips";
        entry.followups.forEach((q) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "chip";
          b.textContent = q;
          b.addEventListener("click", () => handleSend(q));
          chips.appendChild(b);
        });
        more.replaceWith(chips);
      });
      actions.appendChild(more);
    }

    const human = document.createElement("button");
    human.type = "button";
    human.className = "mini primary";
    human.textContent = "转人工";
    human.addEventListener("click", openHuman);
    actions.appendChild(human);

    const fb = document.createElement("div");
    fb.className = "fb";
    fb.innerHTML = '<button type="button" data-v="up" aria-label="有帮助">👍</button><button type="button" data-v="down" aria-label="没帮助">👎</button>';
    fb.querySelectorAll("button").forEach((b) => {
      b.addEventListener("click", () => {
        recordFeedback(entry.id, b.dataset.v);
        fb.className = "fb done";
        fb.textContent = "已记录 · 谢谢反馈";
      });
    });
    actions.appendChild(fb);

    card.appendChild(actions);
    return card;
  }

  function renderCategory(category, customTitle) {
    const popular = ["report-materials", "dorm-assign", "tuition", "military", "map", "fraud", "express", "course-selection"];
    const list = category === "全部"
      ? KB.filter((e) => popular.includes(e.id))
      : KB.filter((e) => e.category === category);

    const card = document.createElement("div");
    card.className = "bubble list-card";

    const h = document.createElement("h3");
    h.textContent = customTitle || (category === "全部" ? "新生最常问的 8 个问题" : "「" + category + "」常见问题");
    card.appendChild(h);

    const sub = document.createElement("p");
    sub.className = "sub";
    sub.textContent = "共 " + list.length + " 条，点一个直接看答案";
    card.appendChild(sub);

    const wrap = document.createElement("div");
    wrap.className = "cat-list";
    list.forEach((e) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cat-item";
      const t = document.createElement("b");
      t.textContent = e.title;
      const arrow = document.createElement("i");
      arrow.textContent = "›";
      b.append(t, arrow);
      b.addEventListener("click", () => handleSend(e.title));
      wrap.appendChild(b);
    });
    card.appendChild(wrap);
    return card;
  }

  function renderChoices(entries, customTitle) {
    const card = document.createElement("div");
    card.className = "bubble list-card";

    const h = document.createElement("h3");
    h.textContent = customTitle || "你是想问哪一个？";
    card.appendChild(h);

    const sub = document.createElement("p");
    sub.className = "sub";
    sub.textContent = "找到 " + entries.length + " 个相近问题，点一个直接看答案";
    card.appendChild(sub);

    const wrap = document.createElement("div");
    wrap.className = "cat-list";
    entries.forEach((e) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cat-item";
      const t = document.createElement("b");
      t.textContent = e.title;
      const arrow = document.createElement("i");
      arrow.textContent = "›";
      b.append(t, arrow);
      b.addEventListener("click", () => handleSend(e.title));
      wrap.appendChild(b);
    });
    card.appendChild(wrap);
    return card;
  }

  function renderIntro() {
    const card = document.createElement("div");
    card.className = "bubble";
    card.innerHTML = '<p class="fallback-title">我是量小新</p><p>中国计量大学的新生助手。现在能回答 ' + KB.length + ' 个迎新高频问题，答案标了来源；不确定的会建议你转人工。</p>';
    const chips = document.createElement("div");
    chips.className = "chips";
    ["报到要带什么材料？", "宿舍怎么分？怎么查？", "学费多少？怎么缴？", "防诈骗提醒"].forEach((q) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = q;
      b.addEventListener("click", () => handleSend(q));
      chips.appendChild(b);
    });
    card.appendChild(chips);
    return card;
  }

  function renderThanks() {
    const card = document.createElement("div");
    card.className = "bubble";
    card.textContent = "不客气。还有问题随时问我，或者点右上角转人工。";
    return card;
  }

  function renderFallback(res) {
    const card = document.createElement("div");
    card.className = "bubble";

    const h = document.createElement("p");
    h.className = "fallback-title";
    h.textContent = "这个问题我暂时没找到官方答案";
    card.appendChild(h);

    const p = document.createElement("p");
    p.textContent = "你可以换个说法，或者先看下面这几个最常问的问题；拿不准的，点“转人工”。";
    card.appendChild(p);

    const fallbackList = (Array.isArray(res.related) && res.related.length)
      ? res.related
      : KB.filter((e) => ["report-materials", "dorm-assign", "tuition"].includes(e.id));

    if (fallbackList.length) {
      const chips = document.createElement("div");
      chips.className = "chips";
      fallbackList.forEach((e) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip";
        b.textContent = e.title;
        b.addEventListener("click", () => handleSend(e.title));
        chips.appendChild(b);
      });
      card.appendChild(chips);
    }

    const actions = document.createElement("div");
    actions.className = "answer-actions";
    const human = document.createElement("button");
    human.type = "button";
    human.className = "mini primary";
    human.textContent = "转人工";
    human.addEventListener("click", openHuman);
    actions.appendChild(human);
    card.appendChild(actions);

    return card;
  }

  function renderLLM(data) {
    const card = document.createElement("div");
    card.className = "bubble answer";

    const head = document.createElement("div");
    head.className = "answer-head";
    const title = document.createElement("h3");
    title.className = "answer-title";
    title.textContent = "量小新 · 大模型回答";
    const badge = document.createElement("span");
    badge.className = "status general";
    badge.textContent = "AI 生成";
    head.append(title, badge);
    card.appendChild(head);

    const body = document.createElement("div");
    String(data.answer || "").split("\n").filter(Boolean).forEach((t) => {
      const p = document.createElement("p");
      p.textContent = t;
      body.appendChild(p);
    });
    card.appendChild(body);

    const source = document.createElement("div");
    source.className = "source";
    source.textContent = "来源：知识库检索 + 大模型生成，请以学校官方发布为准";
    card.appendChild(source);

    const actions = document.createElement("div");
    actions.className = "answer-actions";
    const human = document.createElement("button");
    human.type = "button";
    human.className = "mini primary";
    human.textContent = "转人工";
    human.addEventListener("click", openHuman);
    actions.appendChild(human);
    card.appendChild(actions);

    return card;
  }

  /* ---------------- modal ---------------- */
  function closeModal() {
    modalRoot.innerHTML = "";
  }

  function openModal(innerHTML) {
    modalRoot.innerHTML = '<div class="overlay"><div class="sheet">' + innerHTML + '</div></div>';
    const overlay = modalRoot.querySelector(".overlay");
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
      });
    }
    modalRoot.querySelectorAll("[data-close]").forEach((b) => {
      b.addEventListener("click", closeModal);
    });
  }

  function openHuman() {
    logEvent({ type: "human-click", q: safeText(state.lastQuestion) });
    openModal([
      '<div class="sheet-head"><h3>转人工</h3><button class="x" data-close aria-label="关闭">×</button></div>',
      '<p class="lead">演示版占位。正式上线时替换为学校迎新热线、学院辅导员和迎新系统在线客服。</p>',
      '<div class="contact-list">',
      '<a class="contact" href="https://www.cjlu.edu.cn/" target="_blank" rel="noopener"><div class="cicon">校</div><div class="cbody"><b>学校官网 / 迎新入口</b><small>先核对官方通知和迎新系统</small></div><span class="tag">官方</span></a>',
      '<div class="contact"><div class="cicon">院</div><div class="cbody"><b>学院辅导员</b><small>联系方式见学院迎新群/通知书</small></div><span class="tag">待接入</span></div>',
      '<div class="contact"><div class="cicon">宿</div><div class="cbody"><b>宿管中心</b><small>宿舍分配、维修、门禁</small></div><span class="tag">待接入</span></div>',
      '<div class="contact"><div class="cicon">保</div><div class="cbody"><b>保卫处 / 反诈</b><small>推销、诈骗、人身安全</small></div><span class="tag">待接入</span></div>',
      '<div class="contact"><div class="cicon">心</div><div class="cbody"><b>心理中心</b><small>想家、焦虑、情绪困扰</small></div><span class="tag">待接入</span></div>',
      '</div>',
      '<button class="primary" id="copyQuestion">复制我的问题</button>',
      '<p class="fine">紧急情况：110 / 120 / 119。不要向陌生个人账户转账。</p>'
    ].join(""));

    const copy = modalRoot.querySelector("#copyQuestion");
    if (copy) {
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(state.lastQuestion || "");
          toast("已复制");
        } catch {
          toast("复制失败，请手动选择");
        }
      });
    }
  }

  function openAdmin() {
    const logs = readStore(LS_LOG, []);
    const asks = logs.filter((x) => x.type === "ask").length;
    const hits = logs.filter((x) => x.type === "hit").length;
    const misses = logs.filter((x) => x.type === "miss");
    const humans = logs.filter((x) => x.type === "human" || x.type === "human-click").length;
    const rate = asks ? Math.round((hits / asks) * 100) : 0;

    const map = new Map();
    misses.forEach((m) => map.set(m.q, (map.get(m.q) || 0) + 1));
    const top = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

    openModal([
      '<div class="sheet-head"><h3>运营面板</h3><button class="x" data-close aria-label="关闭">×</button></div>',
      '<p class="lead">数据存在本机浏览器，仅用于演示。导出后可做每周复盘。</p>',
      '<div class="stat-grid">',
      '<div class="stat"><b>' + asks + '</b><small>累计提问</small></div>',
      '<div class="stat"><b>' + rate + '%</b><small>知识库命中率</small></div>',
      '<div class="stat"><b>' + misses.length + '</b><small>未命中</small></div>',
      '<div class="stat"><b>' + humans + '</b><small>转人工点击</small></div>',
      '</div>',
      '<p style="font-size:10.5px;color:#8a9daf;margin:0 0 6px">未命中 Top ' + top.length + '</p>',
      '<ul class="miss-list">' + (top.length
        ? top.map(([q, n]) => '<li><b>' + escapeHTML(q) + '</b><span>' + n + '次</span></li>').join("")
        : '<li>暂无未命中记录</li>') + '</ul>',
      '<div class="admin-actions">',
      '<button class="primary" id="exportLog">导出 JSON</button>',
      '<button class="mini wide" id="clearLog">清空日志</button>',
      '</div>'
    ].join(""));

    const exportBtn = modalRoot.querySelector("#exportLog");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => {
        const data = { exportedAt: new Date().toISOString(), logs, feedback: readStore(LS_FB, []) };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "liangxiaoxin-log-" + new Date().toISOString().slice(0, 10) + ".json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1200);
      });
    }

    const clearBtn = modalRoot.querySelector("#clearLog");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        if (!window.confirm("清空本机日志和反馈？")) return;
        try {
          localStorage.removeItem(LS_LOG);
          localStorage.removeItem(LS_FB);
        } catch { /* ignore */ }
        closeModal();
        toast("已清空");
      });
    }
  }

  /* ---------------- chat flow ---------------- */
  let busy = false;

  async function handleSend(text) {
    const q = String(text || "").trim();
    if (!q || busy) return;

    busy = true;
    state.lastQuestion = q;

    const welcome = chat.querySelector('[data-welcome="1"]');
    if (welcome) welcome.remove();

    addUser(q);
    input.value = "";

    const typing = showTyping();
    await sleep(360);
    typing.remove();

    const res = answer(q);

    if (res.type === "entry") {
      state.lastCategory = res.entry.category;
      state.lastEntryId = res.entry.id;
      addBot(renderAnswer(res.entry));
      logEvent({ type: "hit", q: safeText(q), entryId: res.entry.id });
    } else if (res.type === "category") {
      addBot(renderCategory(res.category, res.title));
      logEvent({ type: "hit", q: safeText(q), entryId: "category:" + res.category });
    } else if (res.type === "choices") {
      addBot(renderChoices(res.entries, res.title));
      logEvent({ type: "hit", q: safeText(q), entryId: "choices" });
    } else if (res.type === "fallback") {
      const llm = await tryLLM(q, res.related);
      if (llm) {
        addBot(renderLLM(llm));
        logEvent({ type: "llm", q: safeText(q) });
      } else {
        addBot(renderFallback(res));
        logEvent({ type: "miss", q: safeText(q) });
      }
    } else if (res.type === "intro") {
      addBot(renderIntro());
    } else if (res.type === "thanks") {
      addBot(renderThanks());
    } else if (res.type === "human") {
      openHuman();
    } else {
      addBot(renderFallback({ related: related(q) }));
      logEvent({ type: "miss", q: safeText(q) });
    }

    logEvent({ type: "ask", q: safeText(q) });
    busy = false;
  }

  async function tryLLM(q, context) {
    if (window.LXX_LLM_ENABLED !== true) return null;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          context: (context || []).map((e) => ({ title: e.title, answer: e.answer, source: e.source }))
        })
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data && data.answer ? data : null;
    } catch {
      return null;
    }
  }

  /* ---------------- init ---------------- */
  function renderCats() {
    ["全部"].concat(CAT_ORDER).forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cat" + (c === "全部" ? " active" : "");
      b.textContent = c;
      b.addEventListener("click", () => {
        state.activeCat = c;
        cats.querySelectorAll(".cat").forEach((x) => x.classList.toggle("active", x === b));
        addBot(renderCategory(c));
        logEvent({ type: "category", q: c });
      });
      cats.appendChild(b);
    });
  }

  composer.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = input.value;
    input.value = "";
    handleSend(v);
  });

  humanBtn.addEventListener("click", openHuman);

  micBtn.addEventListener("click", () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast("当前浏览器不支持语音输入，请用文字");
      return;
    }
    try {
      const rec = new SR();
      rec.lang = "zh-CN";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onstart = () => toast("正在听…");
      rec.onresult = (e) => {
        const text = e.results[0][0].transcript;
        input.value = text;
        input.focus();
      };
      rec.onerror = () => toast("语音识别失败，请用文字");
      rec.start();
    } catch {
      toast("语音启动失败，请用文字");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  const params = new URLSearchParams(location.search);
  if (params.get("admin") === "1") {
    adminBtn.hidden = false;
    adminBtn.addEventListener("click", openAdmin);
  }

  const kbCount = document.getElementById("kbCount");
  if (kbCount) kbCount.textContent = KB.length;

  renderCats();
  renderWelcome();
})();
