/* 量小新 · 新生问答库 */
(() => {
  "use strict";

  const KB = Array.isArray(window.LXX_KB) ? window.LXX_KB : [];
  const $ = (sel, root = document) => root.querySelector(sel);

  const CAT_ORDER = ["报到", "缴费奖助", "宿舍生活", "校区交通", "学习教务", "军训体检", "安全防骗", "家长/心理"];
  const STATUS = {
    official: { label: "官方口径", cls: "official" },
    general: { label: "通用指引", cls: "general" },
    pending: { label: "待官方确认", cls: "pending" }
  };
  const HOT = [
    { label: "报到材料", q: "报到要带什么材料？" },
    { label: "宿舍怎么分", q: "宿舍怎么分？怎么查？" },
    { label: "学费怎么缴", q: "学费多少？怎么缴？" },
    { label: "军训准备", q: "军训要准备什么？" },
    { label: "校园卡丢了", q: "校园卡丢了/怎么充值？" },
    { label: "转专业", q: "转专业什么条件？" }
  ];

  const listEl = $("#list");
  const catsEl = $("#cats");
  const input = $("#q");
  const emptyEl = $("#empty");
  const countEl = $("#count");
  const modeEl = $("#mode");
  const state = { cat: "全部", q: "" };

  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/啥/g, "什么")
      .replace(/咋/g, "怎么")
      .replace(/缴/g, "交")
      .replace(/[^\u4e00-\u9fa5a-z0-9]/g, "");
  }

  function debounce(fn, ms) {
    let t = 0;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function match(e, q) {
    if (!q) return true;
    const nq = norm(q);
    const haystack = [e.title, e.answer, ...(e.aliases || []), ...(e.keywords || [])];
    return haystack.some((x) => norm(x).includes(nq));
  }

  function relevance(e, q) {
    const nq = norm(q);
    let s = 0;
    if (norm(e.title).includes(nq)) s += 3;
    if ((e.aliases || []).some((a) => norm(a).includes(nq))) s += 2;
    if ((e.keywords || []).some((k) => norm(k).includes(nq))) s += 1;
    return s;
  }

  function updateCats() {
    catsEl.querySelectorAll(".cat").forEach((b) => {
      b.classList.toggle("active", b.dataset.cat === state.cat);
    });
  }

  function renderCats() {
    const all = ["全部"].concat(CAT_ORDER);
    all.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cat";
      b.dataset.cat = c;
      b.textContent = c;
      catsEl.appendChild(b);
    });
  }

  function renderHot() {
    const box = $("#hot");
    HOT.forEach((h) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.q = h.q;
      b.textContent = h.label;
      box.appendChild(b);
    });
  }

  function renderCard(e, open) {
    const st = STATUS[e.status] || STATUS.general;
    const d = document.createElement("details");
    d.className = "qa";
    if (open) d.open = true;

    const summary = document.createElement("summary");
    const q = document.createElement("span");
    q.className = "q";
    q.textContent = e.title;
    const badge = document.createElement("span");
    badge.className = "status " + st.cls;
    badge.textContent = st.label;
    summary.append(q, badge);
    d.appendChild(summary);

    const body = document.createElement("div");
    body.className = "qa-body";

    String(e.answer || "").split("\n").filter(Boolean).forEach((t) => {
      const p = document.createElement("p");
      p.textContent = t;
      body.appendChild(p);
    });

    if (Array.isArray(e.steps) && e.steps.length) {
      const ol = document.createElement("ol");
      ol.className = "steps";
      e.steps.forEach((t) => {
        const li = document.createElement("li");
        li.textContent = t;
        ol.appendChild(li);
      });
      body.appendChild(ol);
    }

    const source = document.createElement("div");
    source.className = "source";
    source.appendChild(document.createTextNode("来源："));
    if (e.sourceUrl) {
      const a = document.createElement("a");
      a.href = e.sourceUrl;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = e.source || "学校官网";
      source.appendChild(a);
    } else {
      source.appendChild(document.createTextNode(e.source || "学校官网"));
    }
    source.appendChild(document.createTextNode(" · 更新 " + (e.updated || "—")));
    body.appendChild(source);

    const actions = document.createElement("div");
    actions.className = "qa-actions";

    (e.followups || []).slice(0, 3).forEach((f) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.dataset.q = f;
      b.textContent = f;
      actions.appendChild(b);
    });

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "copy";
    copy.textContent = "复制";
    copy.addEventListener("click", async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      try {
        await navigator.clipboard.writeText(e.title + "\n" + (e.answer || ""));
        copy.textContent = "已复制";
        setTimeout(() => { copy.textContent = "复制"; }, 1500);
      } catch {
        copy.textContent = "复制失败";
      }
    });
    actions.appendChild(copy);

    body.appendChild(actions);
    d.appendChild(body);
    return d;
  }

  function render() {
    const q = state.q.trim();
    let list = KB.filter((e) => {
      if (state.cat !== "全部" && e.category !== state.cat) return false;
      return match(e, q);
    });

    if (q) list = list.slice().sort((a, b) => relevance(b, q) - relevance(a, q));

    countEl.textContent = q ? "找到 " + list.length + " 条" : "共 " + list.length + " 条";
    modeEl.textContent = q
      ? "搜索：" + q
      : state.cat === "全部" ? "全部分类" : "分类：" + state.cat;

    updateCats();
    listEl.innerHTML = "";
    emptyEl.hidden = list.length > 0;

    if (!list.length) return;

    if (!q && state.cat === "全部") {
      CAT_ORDER.forEach((cat) => {
        const items = list.filter((e) => e.category === cat);
        if (!items.length) return;
        const h = document.createElement("h3");
        h.className = "group-title";
        h.textContent = cat;
        const s = document.createElement("span");
        s.textContent = items.length;
        h.appendChild(s);
        listEl.appendChild(h);
        items.forEach((e) => listEl.appendChild(renderCard(e, false)));
      });
    } else {
      list.forEach((e, i) => listEl.appendChild(renderCard(e, i === 0 && !!q)));
    }
  }

  function goFaq() {
    const faq = document.getElementById("faq");
    if (faq) faq.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  document.addEventListener("click", (e) => {
    const catBtn = e.target.closest("[data-cat]");
    if (catBtn) {
      state.cat = catBtn.dataset.cat || "全部";
      state.q = "";
      input.value = "";
      render();
      goFaq();
      return;
    }

    const qBtn = e.target.closest("[data-q]");
    if (qBtn) {
      const q = qBtn.dataset.q;
      if (!q) return;
      state.q = q;
      state.cat = "全部";
      input.value = q;
      render();
      goFaq();
    }
  });

  input.addEventListener("input", debounce(() => {
    state.q = input.value;
    render();
  }, 120));

  $("#clear").addEventListener("click", () => {
    input.value = "";
    state.q = "";
    render();
    input.focus();
  });

  let toastTimer = 0;
  function toast(msg) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
  }

  const micBtn = $("#mic");
  let recognition = null;
  let listening = false;

  function setListening(on) {
    listening = on;
    micBtn.classList.toggle("listening", on);
    micBtn.setAttribute("aria-pressed", on ? "true" : "false");
    micBtn.title = on ? "正在听，点一下停止" : "语音提问";
  }

  micBtn.addEventListener("click", () => {
    if (listening) {
      if (recognition) recognition.stop();
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      toast("当前浏览器不支持语音，请用 Chrome/Edge 或键盘输入");
      return;
    }

    try {
      recognition = new SR();
      recognition.lang = "zh-CN";
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      let finalText = "";

      recognition.onstart = () => {
        setListening(true);
        toast("正在听，请说话…");
      };

      recognition.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) finalText += t;
          else interim += t;
        }
        const text = (finalText + interim).trim();
        if (text) input.value = text;

        if (finalText.trim()) {
          state.q = finalText.trim();
          state.cat = "全部";
          render();
          goFaq();
          toast("已识别：" + finalText.trim());
        }
      };

      recognition.onerror = (e) => {
        setListening(false);
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          toast("麦克风权限被拒绝，请在浏览器设置里允许");
        } else if (e.error === "no-speech") {
          toast("没听到声音，再试一次");
        } else if (e.error === "network") {
          toast("语音服务连不上，请用键盘输入");
        } else {
          toast("语音识别失败，请用文字");
        }
      };

      recognition.onend = () => {
        setListening(false);
        if (!finalText.trim() && input.value.trim()) {
          state.q = input.value.trim();
          state.cat = "全部";
          render();
        }
      };

      recognition.start();
    } catch {
      setListening(false);
      toast("语音启动失败，请用文字");
    }
  });

  $("#expand").addEventListener("click", () => {
    document.querySelectorAll(".qa").forEach((d) => { d.open = true; });
  });

  $("#collapse").addEventListener("click", () => {
    document.querySelectorAll(".qa").forEach((d) => { d.open = false; });
  });

  const total = document.getElementById("kbTotal");
  if (total) total.textContent = KB.length;

  renderCats();
  renderHot();
  render();
})();
