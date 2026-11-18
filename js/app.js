(function () {
  const Store = window.XJStore;
  const PAGES = [
    { id: "eq", name: "裝備" },
    { id: "board", name: "技能盤" },
    { id: "tal", name: "天賦" },
    { id: "attr", name: "屬性" },
  ];
  const GEAR = [
    { id: "weapon", name: "武器" },
    { id: "off", name: "副手" },
    { id: "head", name: "頭飾" },
    { id: "armor", name: "鎧甲" },
    { id: "cloak", name: "披肩" },
    { id: "shoes", name: "鞋子" },
    { id: "accL", name: "飾品左" },
    { id: "accR", name: "飾品右" },
  ];
  const CLASSES = [
    { id: "sword", name: "劍士", lines: [["騎士", "騎士領主", "盧恩騎士"], ["十字軍", "聖殿十字軍", "皇家禁衛隊"]] },
    { id: "bow", name: "弓箭手", lines: [["獵人", "神射手", "遊俠"], ["詩人", "搞笑藝人", "宮廷樂師"], ["舞孃", "吉普賽", "流浪者"]] },
    { id: "mage", name: "魔法師", lines: [["巫師", "超魔導士", "大法師"], ["賢者", "智者", "元素使"]] },
    { id: "thief", name: "盜賊", lines: [["刺客", "十字刺客", "十字斬首者"], ["流氓", "神行太保", "魅影追蹤者"]] },
    { id: "acolyte", name: "服事", lines: [["祭司", "神官", "大主教"], ["武僧", "武術宗師", "修羅"]] },
    { id: "merchant", name: "商人", lines: [["鐵匠", "神工匠", "機匠"], ["鍊金術師", "創造者", "基因學者"]] },
  ];

  const state = {
    builds: [],
    cls: "",
    job: "",
    q: "",
    sort: "updated",
    view: "list",
    buildId: "",
    page: "eq",
    gearSlot: "",
    compare: new Set(),
    draft: null,
    armDelete: "",
    navFolded: false,
  };

  const urls = new Map();
  let seq = 0;
  let saveTimer = 0;

  const main = document.querySelector("#main");
  const nav = document.querySelector("#nav");
  const statusEl = document.querySelector("#status");
  const qEl = document.querySelector("#q");

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function setStatus(text) {
    statusEl.textContent = text || "";
    statusEl.classList.toggle("show", Boolean(text));
  }

  function classOf(id) {
    return CLASSES.find((cls) => cls.id === id);
  }

  function pageName(id) {
    return PAGES.find((item) => item.id === id)?.name || "補充";
  }

  function gearName(id) {
    return GEAR.find((slot) => slot.id === id)?.name || "裝備";
  }

  function activeBuild() {
    if (state.view === "draft") return state.draft;
    if (state.view === "detail") return current();
    return null;
  }

  function icon(name) {
    const paths = {
      plus: `<path d="M12 5v14M5 12h14"/>`,
      paste: `<rect x="8" y="4" width="8" height="4" rx="1"/><path d="M16 6h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2"/><path d="M12 11v6M9 14h6"/>`,
      back: `<path d="M15 6 9 12l6 6"/>`,
      check: `<path d="M5 12.5 10 17.5 19 7"/>`,
      trash: `<path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/>`,
      close: `<path d="M7 7l10 10M17 7 7 17"/>`,
      download: `<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M12 10v7"/><path d="m9 14 3 3 3-3"/>`,
      upload: `<path d="M11 8h3.5L16 10h5v9H11z"/><path d="M3 14.5h8"/><path d="m8 11.5 3 3-3 3"/>`,
      columns: `<rect x="4" y="5" width="6" height="14" rx="1"/><rect x="14" y="5" width="6" height="14" rx="1"/>`,
      pencil: `<path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z"/>`,
      merge: `<path d="M4 7h10a4 4 0 0 1 0 8H8"/><path d="m10 12-3 3 3 3"/>`,
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ""}</svg>`;
  }

  function iconBtn(action, label, name, { className = "", attrs = "" } = {}) {
    return `<button class="icon-btn ${className}" type="button" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${attrs}>${icon(name)}</button>`;
  }

  function draftHasContent(build) {
    if (!build) return false;
    if (Store.imageIds(build).length) return true;
    return ["player", "job", "cls", "style", "level", "floor", "time", "dps", "note"].some((key) => build[key]);
  }

  function blankBuild() {
    return {
      id: crypto.randomUUID(),
      created: Date.now(),
      updated: Date.now(),
      player: "",
      job: "",
      cls: state.cls || "",
      style: "",
      level: "",
      floor: "",
      time: "",
      dps: "",
      note: "",
      tags: "",
      pages: { eq: null, board: null, tal: null, attr: null },
      gear: {},
      extras: [],
    };
  }

  function current() {
    return state.builds.find((build) => build.id === state.buildId) || null;
  }

  async function urlFor(id) {
    if (!id) return "";
    if (urls.has(id)) return urls.get(id);
    const blob = await Store.getImage(id);
    if (!blob) return "";
    const url = URL.createObjectURL(blob);
    urls.set(id, url);
    return url;
  }

  function forgetUrl(id) {
    const url = urls.get(id);
    if (url) URL.revokeObjectURL(url);
    urls.delete(id);
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("讀不到這張圖"));
      };
      img.src = url;
    });
  }

  async function storeImage(file) {
    const img = await loadImage(file);
    const maxW = 1600;
    const scale = Math.min(1, maxW / img.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    const blob = png && png.size < 1_600_000 ? png : await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    return Store.putImage(blob || file);
  }

  async function ingest(file) {
    setStatus("讀取截圖…");
    const imageId = await storeImage(file);
    const build = state.view === "detail" && current() ? current() : state.draft || (state.draft = blankBuild());
    if (build === state.draft) state.view = "draft";
    if (state.page === "eq" && state.gearSlot) {
      await attachGear(build, state.gearSlot, imageId);
      setStatus(`已放入「${gearName(state.gearSlot)}」`);
      await render();
      return;
    }
    const page = state.page;
    await attachToBuild(build, page, imageId);
    const index = PAGES.findIndex((item) => item.id === page);
    const following = PAGES[(index + 1) % PAGES.length].id;
    if (!build.pages[following]?.imageId) state.page = following;
    setStatus(`已放入「${pageName(page)}」`);
    await render();
  }

  async function attachToBuild(build, page, imageId) {
    build.extras = build.extras || [];
    const previous = build.pages[page];
    if (previous?.imageId && previous.imageId !== imageId) {
      await Store.deleteImage(previous.imageId);
      forgetUrl(previous.imageId);
    }
    build.pages[page] = { imageId };
    if (state.view === "detail") scheduleSave(build);
  }

  async function attachGear(build, slot, imageId) {
    build.gear = build.gear || {};
    const previous = build.gear[slot];
    if (previous?.imageId && previous.imageId !== imageId) {
      await Store.deleteImage(previous.imageId);
      forgetUrl(previous.imageId);
    }
    build.gear[slot] = { imageId };
    if (state.view === "detail") scheduleSave(build);
  }

  let warnedClipboardChoice = false;

  async function clipboardPermissionState() {
    try {
      if (!navigator.permissions?.query) return "unknown";
      const status = await navigator.permissions.query({ name: "clipboard-read" });
      return status.state;
    } catch {
      return "unknown";
    }
  }

  async function pasteGear(slot) {
    const pending = navigator.clipboard?.read?.();
    state.page = "eq";
    state.gearSlot = slot;
    const placed = await pasteClipboard(pending);
    if (!placed) {
      await render();
      return;
    }
    if (warnedClipboardChoice) return;
    if ((await clipboardPermissionState()) === "granted") return;
    warnedClipboardChoice = true;
    setStatus(`已放入「${gearName(slot)}」。請在詢問視窗選「允許」，不要選「僅這一次」，之後再貼就不會再問。`);
  }

  function scheduleSave(build) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      build.updated = Date.now();
      await Store.saveBuild(build);
      const index = state.builds.findIndex((item) => item.id === build.id);
      if (index >= 0) state.builds[index] = build;
      else state.builds.unshift(build);
    }, 250);
  }

  function sortBuilds(rows) {
    rows.sort((a, b) => {
      if (state.sort === "floor") return (Number(b.floor) || 0) - (Number(a.floor) || 0) || b.updated - a.updated;
      return b.updated - a.updated;
    });
    return rows;
  }

  function onClassPage(build) {
    if (state.cls && build.cls !== state.cls) return false;
    if (state.job && !(build.job || "").includes(state.job)) return false;
    return true;
  }

  function visibleBuilds() {
    const query = state.q.trim().toLowerCase();
    const rows = state.builds.filter((build) => {
      if (!onClassPage(build)) return false;
      if (!query) return true;
      return `${build.player}\n${build.job}\n${build.style || ""}\n${build.level || ""}\n${build.note}\n${build.floor}`.toLowerCase().includes(query);
    });
    return sortBuilds(rows);
  }

  function comparedBuilds() {
    const rows = sortBuilds(state.builds.filter((build) => state.compare.has(build.id) && onClassPage(build)));
    if (state.cls || rows.length < 2) return rows;
    const classes = [...new Set(rows.map((build) => build.cls || ""))];
    if (classes.length <= 1) return rows;
    const counts = new Map(classes.map((cls) => [cls, rows.filter((build) => (build.cls || "") === cls).length]));
    const cls = classes.slice().sort((a, b) => counts.get(b) - counts.get(a) || classes.indexOf(a) - classes.indexOf(b))[0];
    return rows.filter((build) => (build.cls || "") === cls);
  }

  function compareLabel() {
    const count = comparedBuilds().length;
    return count >= 2 ? `並排 ${count}` : "並排";
  }

  function countFor(clsId) {
    return state.builds.filter((build) => !clsId || build.cls === clsId).length;
  }

  function renderNav() {
    const browsing = state.view !== "tree" && state.view !== "gear" && state.view !== "card" && state.view !== "skill" && state.view !== "misc" && state.view !== "ail" && state.view !== "affix";
    const foldLabel = state.navFolded ? "展開導覽" : "收合導覽";
    const buttons = [
      iconBtn("nav-fold", foldLabel, "back", { className: "nav-fold", attrs: `aria-expanded="${state.navFolded ? "false" : "true"}"` }),
      `<button class="tree-nav" type="button" data-action="tree" aria-pressed="${state.view === "tree"}"><span>天賦樹</span><small>搜尋</small></button>`,
      `<button class="tree-nav" type="button" data-action="gear" aria-pressed="${state.view === "gear"}"><span>裝備清單</span><small>${window.XJGearData?.items.length || ""}</small></button>`,
      `<button class="tree-nav" type="button" data-action="card" aria-pressed="${state.view === "card"}"><span>卡片清單</span><small>${window.XJCardData?.items.length || ""}</small></button>`,
      `<button class="tree-nav" type="button" data-action="skill" aria-pressed="${state.view === "skill"}"><span>技能清單</span><small>${window.XJSkillData?.items.length || ""}</small></button>`,
      `<button class="tree-nav" type="button" data-action="misc" aria-pressed="${state.view === "misc"}"><span>雜物清單</span><small>${window.XJMiscData?.items.length || ""}</small></button>`,
      `<button class="tree-nav" type="button" data-action="ail" aria-pressed="${state.view === "ail"}"><span>狀態效果</span><small>${window.XJAilData?.items.length || ""}</small></button>`,
      `<button class="tree-nav" type="button" data-action="affix" aria-pressed="${state.view === "affix"}"><span>怪物詞綴</span><small>${window.XJAffixData?.items.length || ""}</small></button>`,
      `<button type="button" data-action="cls" data-cls="" aria-pressed="${browsing && state.cls === ""}"><span>全部</span><small>${countFor("")}</small></button>`,
    ];
    for (const cls of CLASSES) {
      buttons.push(
        `<button type="button" data-action="cls" data-cls="${cls.id}" aria-pressed="${browsing && state.cls === cls.id}"><span><i class="swatch ${cls.id}"></i>${esc(cls.name)}</span><small>${countFor(cls.id)}</small></button>`,
      );
    }
    nav.innerHTML = buttons.join("");
    applyNavFold();
  }

  function applyNavFold() {
    document.querySelector(".layout").classList.toggle("nav-folded", state.navFolded);
    const button = nav.querySelector(".nav-fold");
    if (!button) return;
    const label = state.navFolded ? "展開導覽" : "收合導覽";
    button.setAttribute("aria-expanded", String(!state.navFolded));
    button.setAttribute("aria-label", label);
    button.title = label;
  }

  async function render() {
    const token = ++seq;
    renderNav();
    if (state.view === "tree") {
      if (token !== seq) return;
      window.XJGear?.unmount();
      window.XJCard?.unmount();
      window.XJSkill?.unmount();
      window.XJMisc?.unmount();
      window.XJAil?.unmount();
      window.XJAffix?.unmount();
      window.XJTree.mount(main);
      return;
    }
    window.XJTree?.unmount();
    if (state.view === "gear") {
      if (token !== seq) return;
      window.XJCard?.unmount();
      window.XJSkill?.unmount();
      window.XJMisc?.unmount();
      window.XJAil?.unmount();
      window.XJAffix?.unmount();
      window.XJGear.mount(main);
      return;
    }
    window.XJGear?.unmount();
    if (state.view === "card") {
      if (token !== seq) return;
      window.XJSkill?.unmount();
      window.XJMisc?.unmount();
      window.XJAil?.unmount();
      window.XJAffix?.unmount();
      window.XJCard.mount(main);
      return;
    }
    window.XJCard?.unmount();
    if (state.view === "skill") {
      if (token !== seq) return;
      window.XJMisc?.unmount();
      window.XJAil?.unmount();
      window.XJAffix?.unmount();
      window.XJSkill.mount(main);
      return;
    }
    window.XJSkill?.unmount();
    if (state.view === "misc") {
      if (token !== seq) return;
      window.XJAil?.unmount();
      window.XJAffix?.unmount();
      window.XJMisc.mount(main);
      return;
    }
    window.XJMisc?.unmount();
    if (state.view === "ail") {
      if (token !== seq) return;
      window.XJAffix?.unmount();
      window.XJAil.mount(main);
      return;
    }
    window.XJAil?.unmount();
    if (state.view === "affix") {
      if (token !== seq) return;
      window.XJAffix.mount(main);
      return;
    }
    window.XJAffix?.unmount();
    let html = "";
    if (state.view === "draft") html = await draftHtml();
    else if (state.view === "detail") html = await detailHtml(current());
    else if (state.view === "compare") html = await compareHtml();
    else html = await listHtml();
    if (token !== seq) return;
    main.innerHTML = html;
    bindZoom();
  }

  function bindZoom() {
    for (const frame of main.querySelectorAll(".shot, .compare article")) {
      const img = frame.querySelector(":scope > img");
      if (!img) continue;
      let scale = 1;
      let x = 0;
      let y = 0;
      let drag = null;

      const apply = () => {
        img.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        frame.classList.toggle("zoomed", scale > 1);
      };

      frame.addEventListener("wheel", (event) => {
        const onShot = frame.classList.contains("shot");
        if (!onShot && event.target !== img && !frame.classList.contains("zoomed")) return;
        event.preventDefault();
        const rect = img.getBoundingClientRect();
        const mx = event.clientX - (rect.left + rect.width / 2 - x);
        const my = event.clientY - (rect.top + rect.height / 2 - y);
        const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
        if (!delta) return;
        const next = Math.min(8, Math.max(1, scale * Math.exp(-delta * 0.0016)));
        const ratio = next / scale;
        x = mx - (mx - x) * ratio;
        y = my - (my - y) * ratio;
        scale = next;
        if (scale <= 1.01) {
          scale = 1;
          x = 0;
          y = 0;
        }
        apply();
      }, { passive: false });

      frame.addEventListener("pointerdown", (event) => {
        if (scale <= 1 || event.button !== 0 || event.target.closest("button, a, input, label")) return;
        drag = { x: event.clientX, y: event.clientY, ox: x, oy: y };
        frame.classList.add("dragging");
        frame.setPointerCapture(event.pointerId);
      });
      frame.addEventListener("pointermove", (event) => {
        if (!drag) return;
        x = drag.ox + event.clientX - drag.x;
        y = drag.oy + event.clientY - drag.y;
        apply();
      });
      const endDrag = () => {
        drag = null;
        frame.classList.remove("dragging");
      };
      frame.addEventListener("pointerup", endDrag);
      frame.addEventListener("pointercancel", endDrag);
    }
  }

  function dots(build) {
    return PAGES.map((page) => `<i class="${build.pages?.[page.id]?.imageId ? "on" : ""}">${page.name.slice(0, 1)}</i>`).join("");
  }

  async function listHtml() {
    const rows = visibleBuilds();
    const cls = classOf(state.cls);
    const chips = cls
      ? [`<button type="button" data-action="job" data-job="" aria-pressed="${state.job === ""}">全部${esc(cls.name)}</button>`]
          .concat(cls.lines.flat().map((job) => `<button type="button" data-action="job" data-job="${esc(job)}" aria-pressed="${state.job === job}">${esc(job)}</button>`))
          .join("")
      : "";
    const draftBanner = draftHasContent(state.draft)
      ? `<div class="banner"><span>有一筆還沒存的截圖${state.draft.player ? `：${esc(state.draft.player)}` : ""}。</span>${iconBtn("resume-draft", "繼續編輯", "pencil")}</div>`
      : "";
    const cards = [];
    for (const build of rows) {
      const shot = build.pages?.eq?.imageId || build.pages?.board?.imageId || build.pages?.tal?.imageId || build.pages?.attr?.imageId;
      const url = shot ? await urlFor(shot) : "";
      const title = build.player || build.job || "未命名構築";
      const jobLabel = build.job ? `${build.job}${build.style ? `（${build.style}）` : ""}` : (build.style || "");
      const meta = [jobLabel, build.floor ? `${build.floor} 層` : "", build.time || ""].filter(Boolean).join(" · ");
      cards.push(`<article class="card">
        <button class="card-open" type="button" data-action="open" data-id="${build.id}">
          ${url ? `<img class="thumb" alt="" src="${url}">` : `<span class="thumb empty">尚未貼上截圖</span>`}
          <div class="card-body">
            <h2>${esc(title)}</h2>
            <div class="meta">${esc(meta || "補上職業或層數，之後比較會更快")}</div>
            <div class="sub">${esc(build.note || "")}</div>
          </div>
        </button>
        <div class="card-foot">
          <span class="dots">${dots(build)}</span>
          <select class="move" data-action="move" data-id="${build.id}" aria-label="搬移分類">${classOptions(build.cls)}</select>
          <label class="compare-toggle"><input type="checkbox" data-action="compare" data-id="${build.id}" ${state.compare.has(build.id) ? "checked" : ""}> 比較</label>
        </div>
      </article>`);
    }
    const body = rows.length
      ? `<div class="cards">${cards.join("")}</div>`
      : emptyState();
    return `${draftBanner}
      <div class="toolbar">
        <div class="chips">${chips}</div>
        <select data-action="sort" aria-label="排序">
          <option value="updated" ${state.sort === "updated" ? "selected" : ""}>最近更新</option>
          <option value="floor" ${state.sort === "floor" ? "selected" : ""}>層數高的在前</option>
        </select>
        ${iconBtn("compare-open", compareLabel(), "columns", { attrs: comparedBuilds().length < 2 ? "disabled" : "" })}
      </div>
      ${body}`;
  }

  function emptyState() {
    const filtered = state.builds.length > 0;
    if (filtered) return `<div class="empty"><h2>這個篩選沒有紀錄</h2><p>換一個職業，或清掉搜尋字。</p></div>`;
    return `<div class="empty">
      <h2>把排行榜構築存下來</h2>
      <p>到 <a href="https://www.xianjing.dev/" target="_blank" rel="noopener">流浪仙境</a> 的選單打開線上排行，點玩家旁邊的 ▸，再切換裝備、技能盤、天賦、屬性。</p>
      <ol class="steps">
        <li><b>1</b><span>用 <kbd>Win</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> 框選構築視窗。</span></li>
        <li><b>2</b><span>按右上角的新增，再到畫面裡按剪貼簿圖示貼上。連續貼上會依序放到裝備、技能盤、天賦、屬性。</span></li>
        <li><b>3</b><span>要換掉某一頁，先點那個頁籤再貼一次。</span></li>
      </ol>
    </div>`;
  }

  function classOptions(selected) {
    const blank = `<option value="" ${selected ? "" : "selected"}>未分類</option>`;
    const rest = CLASSES.map((cls) => `<option value="${cls.id}" ${selected === cls.id ? "selected" : ""}>${esc(cls.name)}</option>`).join("");
    return blank + rest;
  }

  function assignClass(build, clsId) {
    build.cls = clsId;
    const jobs = classOf(clsId)?.lines.flat() || [];
    const official = CLASSES.some((cls) => cls.lines.flat().includes(build.job));
    if (build.job && official && clsId && !jobs.includes(build.job)) build.job = "";
  }

  function jobMenu(selected) {
    const known = new Set(CLASSES.flatMap((cls) => cls.lines.flat()));
    const groups = CLASSES.map((cls) => {
      const options = cls.lines.flat().map((job) => `<option value="${esc(job)}" ${job === selected ? "selected" : ""}>${esc(job)}</option>`).join("");
      return `<optgroup label="${esc(cls.name)}">${options}</optgroup>`;
    }).join("");
    const custom = selected && !known.has(selected) ? `<option value="${esc(selected)}" selected>${esc(selected)}</option>` : "";
    return `<option value="">選擇職業</option>${custom}${groups}`;
  }

  function headerFields(build) {
    const options = classOptions(build.cls);
    return `<div class="ocr-row">${iconBtn("ocr", "貼上剪貼簿辨識", "paste", { className: "primary" })}</div>
    <div class="fields">
      <label class="field">玩家<input data-field="player" value="${esc(build.player)}" maxlength="16"></label>
      <label class="field">職業<select data-field="job">${jobMenu(build.job)}</select></label>
      <label class="field">流派<input data-field="style" value="${esc(build.style)}" placeholder="技能流"></label>
      <label class="field">等級<input data-field="level" value="${esc(build.level)}" inputmode="numeric"></label>
      <label class="field">分類<select data-field="cls">${options}</select></label>
      <label class="field">層數<input data-field="floor" value="${esc(build.floor)}" inputmode="numeric"></label>
      <label class="field">用時<input data-field="time" value="${esc(build.time)}" placeholder="0:51"></label>
      <label class="field">DPS<input data-field="dps" value="${esc(build.dps)}" placeholder="1.17T"></label>
      <label class="field wide">備註<textarea data-field="note">${esc(build.note)}</textarea></label>
    </div>`;
  }

  async function shotHtml(build) {
    const focusingGear = state.page === "eq" && state.gearSlot;
    const page = build.pages?.[state.page];
    const gearImage = focusingGear ? build.gear?.[state.gearSlot]?.imageId : "";
    const url = gearImage ? await urlFor(gearImage) : page?.imageId ? await urlFor(page.imageId) : "";
    const label = focusingGear ? gearName(state.gearSlot) : pageName(state.page);
    const extras = [];
    for (const extra of build.extras || []) {
      const extraUrl = await urlFor(extra.imageId);
      if (extraUrl) extras.push(`<figure><img alt="" src="${extraUrl}" draggable="false"><figcaption>${esc(extra.caption || "補充")}</figcaption></figure>`);
    }
    const placeholder = focusingGear
      ? iconBtn("gear-paste", `貼上${label}`, "plus", { className: "xl", attrs: `data-slot="${state.gearSlot}"` })
      : iconBtn("paste", "貼上剪貼簿", "paste", { className: "xl" });
    return `<div class="shot-wrap">
      <div class="pager">${PAGES.map((item) => `<button type="button" data-action="page" data-page="${item.id}" aria-pressed="${state.page === item.id}">${item.name}</button>`).join("")}${iconBtn("paste", "貼上剪貼簿", "paste")}</div>
      <div class="shot">${url ? `<img alt="${esc(label)}截圖" src="${url}" draggable="false">` : `<div class="placeholder">${placeholder}</div>`}</div>
      ${state.page === "eq" ? await gearHtml(build) : ""}
      ${extras.length ? `<div class="extras">${extras.join("")}</div>` : ""}
    </div>`;
  }

  async function gearHtml(build) {
    const cells = [];
    for (const slot of GEAR) {
      const imageId = build.gear?.[slot.id]?.imageId;
      const url = imageId ? await urlFor(imageId) : "";
      const selected = state.gearSlot === slot.id;
      const openLabel = url ? slot.name : `貼上${slot.name}`;
      cells.push(`<div class="gear-slot${selected ? " selected" : ""}">
        <button type="button" class="gear-open" data-action="${url ? "gear" : "gear-paste"}" data-slot="${slot.id}" aria-pressed="${selected}" aria-label="${esc(openLabel)}">${url ? `<img alt="" src="${url}" draggable="false">` : icon("plus")}</button>
        <span>${esc(slot.name)}</span>
        <div class="gear-tools">
          ${url ? iconBtn("gear-paste", `貼上${slot.name}`, "plus", { className: "tiny", attrs: `data-slot="${slot.id}"` }) : ""}
          ${url ? iconBtn("gear-clear", `移除${slot.name}`, "close", { className: "tiny", attrs: `data-slot="${slot.id}"` }) : ""}
        </div>
      </div>`);
    }
    return `<div class="gear">${cells.join("")}</div>`;
  }

  async function detailHtml(build) {
    if (!build) return emptyState();
    return `<div class="toolbar">
        ${iconBtn("back", "返回清單", "back")}
        ${iconBtn("delete", state.armDelete === build.id ? "再按一次刪除" : "刪除", "trash", { className: state.armDelete === build.id ? "danger armed" : "danger", attrs: `data-id="${build.id}"` })}
      </div>
      <div class="detail">
        ${await shotHtml(build)}
        <div class="sheet">
          ${headerFields(build)}
          <p class="hint">滾輪放大縮小，放大後按住拖曳。1 到 4 切換頁面，貼上會蓋掉目前這一頁。裝備格子按 + 會從剪貼簿放入，瀏覽器只在第一次問是否允許。</p>
        </div>
      </div>`;
  }

  async function draftHtml() {
    const build = state.draft;
    if (!build) return emptyState();
    const similar = state.builds.find((item) => item.player && item.player === build.player && item.floor && item.floor === build.floor && item.job && item.job === build.job);
    return `<div class="toolbar">
        ${iconBtn("back", "返回清單", "back")}
        ${iconBtn("save-draft", "存成一筆構築", "check", { className: "primary" })}
        ${iconBtn("discard-draft", "放棄這幾張", "close")}
      </div>
      ${similar ? `<div class="banner"><span>清單裡已有「${esc(similar.player)}」第 ${esc(similar.floor)} 層。可以把這次的截圖補進那一筆。</span>${iconBtn("merge-draft", "補進原紀錄", "merge", { className: "primary", attrs: `data-id="${similar.id}"` })}</div>` : ""}
      <p class="hint">按剪貼簿圖示貼上，會依序放到裝備、技能盤、天賦、屬性。要重貼某一頁，先點那個頁籤。裝備格子按 + 會從剪貼簿放入，瀏覽器只在第一次問是否允許。</p>
      <div class="detail">
        ${await shotHtml(build)}
        <div class="sheet">
          ${headerFields(build)}
        </div>
      </div>`;
  }

  async function compareGearHtml(build) {
    const cells = [];
    for (const slot of GEAR) {
      const imageId = build.gear?.[slot.id]?.imageId;
      const url = imageId ? await urlFor(imageId) : "";
      const selected = state.gearSlot === slot.id;
      cells.push(`<button type="button" class="compare-slot${url ? " filled" : ""}" data-action="gear" data-slot="${slot.id}" aria-pressed="${selected}" aria-label="${esc(slot.name)}">${url ? `<img alt="" src="${url}" draggable="false">` : `<i></i>`}<span>${esc(slot.name)}</span></button>`);
    }
    return `<div class="compare-gear">${cells.join("")}</div>`;
  }

  async function compareHtml() {
    const builds = comparedBuilds();
    const focusingGear = state.page === "eq" && state.gearSlot;
    const blocks = [];
    for (const build of builds) {
      const imageId = focusingGear ? build.gear?.[state.gearSlot]?.imageId : build.pages?.[state.page]?.imageId;
      const url = imageId ? await urlFor(imageId) : "";
      const missing = focusingGear ? `沒有${gearName(state.gearSlot)}細項` : "這一頁沒有截圖";
      const gear = state.page === "eq" ? await compareGearHtml(build) : "";
      const meta = [build.job, build.floor ? `${build.floor} 層` : "", focusingGear ? gearName(state.gearSlot) : ""].filter(Boolean).join(" · ");
      blocks.push(`<article>
        <div class="pad"><strong>${esc(build.player || "未命名")}</strong><div class="meta">${esc(meta)}</div></div>
        ${url ? `<img alt="" src="${url}" draggable="false">` : `<div class="placeholder">${esc(missing)}</div>`}
        ${gear}
      </article>`);
    }
    const slots = GEAR.map((slot) => `<button type="button" data-action="gear" data-slot="${slot.id}" aria-pressed="${state.gearSlot === slot.id}">${slot.name}</button>`).join("");
    const gearPager = state.page === "eq"
      ? `<div class="pager compare-slots"><span>細項</span><button type="button" data-action="page" data-page="eq" aria-pressed="${!state.gearSlot}">總覽</button>${slots}</div>`
      : "";
    return `<div class="toolbar">
      ${iconBtn("back", "返回清單", "back")}
      <div class="pager">${PAGES.map((item) => `<button type="button" data-action="page" data-page="${item.id}" aria-pressed="${state.page === item.id}">${item.name}</button>`).join("")}</div>
      ${gearPager}
    </div>
    <div class="compare">${blocks.join("") || `<p>先在這個職業勾兩筆再比較。</p>`}</div>`;
  }

  function readField(build, field, value) {
    build[field] = value;
  }

  function jobNames() {
    return CLASSES.flatMap((cls) => cls.lines.flat());
  }

  function applyRank(build, parsed) {
    const labels = [];
    const set = (key, value, label) => {
      if (!value) return;
      build[key] = value;
      labels.push(label);
    };
    set("player", parsed.player, "玩家");
    if (parsed.job) {
      build.job = parsed.job;
      const owner = CLASSES.find((cls) => cls.lines.flat().includes(parsed.job));
      if (owner) build.cls = owner.id;
      labels.push("職業");
    }
    set("style", parsed.style, "流派");
    set("level", parsed.level, "等級");
    set("floor", parsed.floor, "層數");
    set("time", parsed.time, "用時");
    set("dps", parsed.dps, "DPS");
    return labels;
  }

  let ocrBusy = false;

  async function recognizeRankClipboard(pending) {
    const build = activeBuild();
    if (!build || ocrBusy) return;
    const files = await readClipboardFiles(pending);
    if (!files.length) return;
    ocrBusy = true;
    setStatus("正在辨識排行截圖…");
    try {
      const parsed = await window.XJOcr.recognizeRank(files[0], jobNames(), setStatus);
      const labels = applyRank(build, parsed);
      if (!labels.length) {
        setStatus("這張圖認不出排行資訊");
        return;
      }
      if (state.view === "detail") await persist(build);
      setStatus(`已填入${labels.join("、")}`);
      await render();
    } finally {
      ocrBusy = false;
    }
  }

  async function moveBuild(id, clsId) {
    const build = state.builds.find((item) => item.id === id);
    if (!build) return;
    assignClass(build, clsId);
    await persist(build);
    const name = classOf(build.cls)?.name || "未分類";
    setStatus(`已搬到${name}`);
    await render();
  }

  async function persist(build) {
    build.updated = Date.now();
    await Store.saveBuild(build);
    const index = state.builds.findIndex((item) => item.id === build.id);
    if (index >= 0) state.builds[index] = build;
    else state.builds.unshift(build);
  }

  async function onClick(event) {
    const el = event.target.closest("[data-action]");
    if (!el || el.matches("input, select, textarea")) return;
    const action = el.dataset.action;
    if (action === "nav-fold") {
      state.navFolded = !state.navFolded;
      applyNavFold();
      return;
    }
    if (action === "tree") {
      state.view = "tree";
      await render();
    } else if (action === "gear" && !el.dataset.slot) {
      state.view = "gear";
      await render();
    } else if (action === "card") {
      state.view = "card";
      await render();
    } else if (action === "skill") {
      state.view = "skill";
      await render();
    } else if (action === "misc") {
      state.view = "misc";
      await render();
    } else if (action === "ail") {
      state.view = "ail";
      await render();
    } else if (action === "affix") {
      state.view = "affix";
      await render();
    } else if (action === "cls") {
      state.cls = el.dataset.cls || "";
      state.job = "";
      state.view = "list";
      await render();
    } else if (action === "job") {
      state.job = el.dataset.job || "";
      await render();
    } else if (action === "open") {
      state.buildId = el.dataset.id;
      state.view = "detail";
      state.page = "eq";
      state.gearSlot = "";
      state.armDelete = "";
      await render();
    } else if (action === "back") {
      if (state.view === "draft" && !draftHasContent(state.draft)) state.draft = null;
      state.view = "list";
      state.armDelete = "";
      await render();
    } else if (action === "ocr") {
      const pending = navigator.clipboard?.read?.();
      await recognizeRankClipboard(pending);
    } else if (action === "paste") {
      await pasteClipboard();
    } else if (action === "page") {
      const next = el.dataset.page;
      if (next === "eq" && state.page === "eq" && state.gearSlot) state.gearSlot = "";
      else {
        state.page = next;
        if (next !== "eq") state.gearSlot = "";
      }
      await render();
    } else if (action === "gear") {
      state.page = "eq";
      const slot = el.dataset.slot;
      state.gearSlot = state.view === "compare" && state.gearSlot === slot ? "" : slot;
      await render();
    } else if (action === "gear-paste") {
      await pasteGear(el.dataset.slot);
    } else if (action === "gear-clear") {
      const build = activeBuild();
      const slot = el.dataset.slot;
      const previous = build?.gear?.[slot];
      if (previous?.imageId) {
        await Store.deleteImage(previous.imageId);
        forgetUrl(previous.imageId);
      }
      if (build?.gear) delete build.gear[slot];
      if (state.view === "detail" && build) scheduleSave(build);
      await render();
    } else if (action === "resume-draft") {
      state.view = "draft";
      await render();
    } else if (action === "save-draft") {
      await persist(state.draft);
      state.buildId = state.draft.id;
      state.draft = null;
      state.view = "detail";
      setStatus("已存進這個瀏覽器");
      await render();
    } else if (action === "discard-draft") {
      await deleteBuildImages(state.draft);
      state.draft = null;
      state.view = "list";
      setStatus("");
      await render();
    } else if (action === "merge-draft") {
      const target = state.builds.find((build) => build.id === el.dataset.id);
      if (target && state.draft) {
        target.extras = target.extras || [];
        for (const page of PAGES) {
          const incoming = state.draft.pages[page.id];
          if (!incoming?.imageId) continue;
          if (!target.pages[page.id]?.imageId) target.pages[page.id] = incoming;
          else target.extras.push({ id: crypto.randomUUID(), imageId: incoming.imageId, caption: `${page.name}（後補）` });
        }
        target.extras = target.extras.concat(state.draft.extras || []);
        target.gear = target.gear || {};
        for (const slot of GEAR) {
          const incoming = state.draft.gear?.[slot.id];
          if (!incoming?.imageId) continue;
          if (!target.gear[slot.id]?.imageId) target.gear[slot.id] = incoming;
          else target.extras.push({ id: crypto.randomUUID(), imageId: incoming.imageId, caption: `${slot.name}（後補）` });
        }
        fillMissing(target, state.draft);
        await persist(target);
        state.draft = null;
        state.buildId = target.id;
        state.view = "detail";
        setStatus("已補進原本那一筆");
        await render();
      }
    } else if (action === "delete") {
      if (state.armDelete !== el.dataset.id) {
        state.armDelete = el.dataset.id;
        await render();
        return;
      }
      const build = current();
      await deleteBuildImages(build);
      await Store.deleteBuild(build.id);
      state.builds = state.builds.filter((item) => item.id !== build.id);
      state.compare.delete(build.id);
      state.view = "list";
      state.armDelete = "";
      await render();
    } else if (action === "compare-open") {
      const chosen = comparedBuilds();
      const onPage = state.builds.filter((build) => state.compare.has(build.id) && onClassPage(build));
      state.view = "compare";
      if (onPage.length > chosen.length) {
        const name = classOf(chosen[0]?.cls)?.name || "這個職業";
        setStatus(`只並排${name}，其他職業請到各自的頁面比較`);
      }
      await render();
    }
  }

  function fillMissing(target, source) {
    for (const key of ["player", "job", "cls", "style", "level", "floor", "time", "dps", "note"]) {
      if (!target[key] && source[key]) target[key] = source[key];
    }
  }

  async function deleteBuildImages(build) {
    if (!build) return;
    for (const id of Store.imageIds(build)) {
      await Store.deleteImage(id);
      forgetUrl(id);
    }
  }

  function onInput(event) {
    const el = event.target;
    const build = state.view === "draft" ? state.draft : current();
    if (!build) return;
    if (el.dataset.field) readField(build, el.dataset.field, el.value);
    else return;
    if (el.dataset.field === "job" && el.value) {
      const owner = CLASSES.find((cls) => cls.lines.flat().includes(el.value));
      if (owner) {
        build.cls = owner.id;
        const clsSelect = el.closest(".fields")?.querySelector("[data-field='cls']");
        if (clsSelect) clsSelect.value = owner.id;
        renderNav();
      }
    }
    if (el.dataset.field === "cls") {
      assignClass(build, el.value);
      const jobSelect = el.closest(".fields")?.querySelector("[data-field='job']");
      if (jobSelect && !build.job) jobSelect.value = "";
      renderNav();
      setStatus(`已搬到${classOf(build.cls)?.name || "未分類"}`);
    }
    if (state.view === "detail") scheduleSave(build);
  }

  function onChange(event) {
    const el = event.target;
    if (el.dataset.action === "move") {
      moveBuild(el.dataset.id, el.value).catch((error) => setStatus(error.message || "搬移失敗"));
      return;
    }
    if (el.dataset.action === "sort") {
      state.sort = el.value;
      render();
      return;
    }
    if (el.dataset.action === "compare") {
      if (el.checked) state.compare.add(el.dataset.id);
      else state.compare.delete(el.dataset.id);
      const button = main.querySelector("[data-action='compare-open']");
      if (button) {
        const label = compareLabel();
        button.disabled = comparedBuilds().length < 2;
        button.title = label;
        button.setAttribute("aria-label", label);
      }
      return;
    }
    onInput(event);
  }

  function filesFromClipboard(data) {
    return [...(data?.items || [])].filter((item) => item.type.startsWith("image/")).map((item) => item.getAsFile()).filter(Boolean);
  }

  async function readClipboardFiles(pending) {
    if (!pending && !navigator.clipboard?.read) {
      setStatus("這個瀏覽器讀不到剪貼簿");
      return [];
    }
    let items = [];
    try {
      items = await (pending || navigator.clipboard.read());
    } catch {
      setStatus("沒有取得剪貼簿，請允許這個頁面讀取");
      return [];
    }
    const files = [];
    for (const item of items) {
      const type = item.types.find((entry) => entry.startsWith("image/"));
      if (!type) continue;
      const blob = await item.getType(type);
      files.push(new File([blob], "clipboard.png", { type: blob.type || type }));
    }
    if (!files.length) setStatus("剪貼簿裡沒有圖片");
    return files;
  }

  async function pasteClipboard(pending) {
    const files = await readClipboardFiles(pending);
    if (!files.length) return false;
    await takeFiles(files);
    return true;
  }

  async function startDraft() {
    if (draftHasContent(state.draft)) {
      state.view = "draft";
      await render();
      return;
    }
    state.draft = blankBuild();
    state.view = "draft";
    state.page = "eq";
    state.armDelete = "";
    await render();
  }

  async function takeFiles(files) {
    for (const file of files) {
      if (file && file.type.startsWith("image/")) await ingest(file);
    }
  }

  async function exportJson() {
    setStatus("正在打包截圖…");
    const builds = [];
    for (const build of state.builds) {
      const images = {};
      for (const id of Store.imageIds(build)) {
        const blob = await Store.getImage(id);
        if (!blob) continue;
        images[id] = await blobToDataUrl(blob);
      }
      builds.push({ ...build, images });
    }
    const payload = { kind: "xj-memo", version: 1, exportedAt: new Date().toISOString(), builds };
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `流浪仙境構築筆記-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("已下載備份。匯入時會先清掉目前所有構築，再以這份備份覆蓋。");
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  function remapBuildImages(build, map) {
    for (const page of Object.values(build.pages || {})) {
      if (page?.imageId && map.has(page.imageId)) page.imageId = map.get(page.imageId);
    }
    for (const extra of build.extras || []) {
      if (extra.imageId && map.has(extra.imageId)) extra.imageId = map.get(extra.imageId);
    }
    for (const slot of Object.values(build.gear || {})) {
      if (slot?.imageId && map.has(slot.imageId)) slot.imageId = map.get(slot.imageId);
    }
  }

  async function clearLibrary() {
    for (const build of state.builds) {
      for (const id of Store.imageIds(build)) forgetUrl(id);
    }
    if (state.draft) {
      for (const id of Store.imageIds(state.draft)) forgetUrl(id);
    }
    await Store.clearAll();
    state.builds = [];
    state.compare = new Set();
    state.buildId = "";
    state.draft = null;
    state.view = "list";
    state.page = "eq";
    state.gearSlot = "";
    state.armDelete = "";
  }

  let importBusy = false;

  async function importJson(file) {
    if (importBusy) {
      setStatus("上一份備份還在匯入");
      return;
    }
    importBusy = true;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data?.kind !== "xj-memo" || !Array.isArray(data.builds)) {
        setStatus("這個檔案不是構築備份");
        return;
      }
      const prepared = [];
      for (const row of data.builds) {
        const build = { ...row };
        delete build.images;
        if (!build.id) build.id = crypto.randomUUID();
        if (!build.created) build.created = Date.now();
        const images = [];
        for (const [oldId, dataUrl] of Object.entries(row.images || {})) {
          const blob = await (await fetch(dataUrl)).blob();
          images.push({ oldId, blob });
        }
        prepared.push({ build, images });
      }
      await clearLibrary();
      for (const item of prepared) {
        const map = new Map();
        for (const image of item.images) {
          const id = await Store.putImage(image.blob);
          map.set(image.oldId, id);
        }
        remapBuildImages(item.build, map);
        await persist(item.build);
      }
      setStatus(prepared.length ? `已覆蓋匯入 ${prepared.length} 筆` : "已清除原本的構築，備份裡沒有構築");
      await render();
    } finally {
      importBusy = false;
    }
  }

  document.querySelector("#add-blank").innerHTML = icon("plus");
  document.querySelector("#paste-clip").innerHTML = icon("paste");
  document.querySelector("#export").innerHTML = `${icon("download")}<span>匯出</span>`;
  document.querySelector("#import").innerHTML = `${icon("upload")}<span>匯入</span>`;
  document.querySelector("#add-blank").addEventListener("click", () => startDraft().catch((error) => setStatus(error.message || "新增失敗")));
  document.querySelector("#paste-clip").addEventListener("click", () => pasteClipboard().catch((error) => setStatus(error.message || "貼上失敗")));
  document.querySelector("#export").addEventListener("click", () => exportJson().catch((error) => setStatus(error.message)));
  document.querySelector("#import").addEventListener("click", () => document.querySelector("#import-file").click());
  document.querySelector("#import-file").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) importJson(file).catch(() => setStatus("這個檔案讀不起來"));
  });
  qEl.addEventListener("input", () => {
    state.q = qEl.value;
    if (state.view === "list") render();
  });
  nav.addEventListener("click", (event) => onClick(event).catch((error) => setStatus(error.message || "操作失敗")));
  main.addEventListener("click", (event) => onClick(event).catch((error) => setStatus(error.message || "操作失敗")));
  main.addEventListener("input", onInput);
  main.addEventListener("change", onChange);

  document.addEventListener("paste", (event) => {
    const files = filesFromClipboard(event.clipboardData);
    if (!files.length) return;
    event.preventDefault();
    takeFiles(files).catch((error) => setStatus(error.message || "貼上失敗"));
  });
  const dropEl = document.querySelector("#drop");
  let dropTimer = 0;
  function hideDrop() {
    clearTimeout(dropTimer);
    dropEl.classList.remove("show");
  }
  function isFileDrag(event) {
    return [...(event.dataTransfer?.items || [])].some((item) => item.kind === "file");
  }
  document.addEventListener("dragover", (event) => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dropEl.classList.add("show");
    clearTimeout(dropTimer);
    dropTimer = setTimeout(hideDrop, 400);
  });
  document.addEventListener("dragleave", (event) => {
    const outside = event.clientX <= 0 || event.clientY <= 0 || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight;
    if (outside) hideDrop();
  });
  document.addEventListener("drop", (event) => {
    event.preventDefault();
    hideDrop();
    takeFiles([...(event.dataTransfer?.files || [])]).catch((error) => setStatus(error.message || "拖放失敗"));
  });
  document.addEventListener("dragend", hideDrop);
  window.addEventListener("blur", hideDrop);
  dropEl.addEventListener("click", hideDrop);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && dropEl.classList.contains("show")) {
      hideDrop();
      return;
    }
    if (event.target.matches("input, textarea, select")) {
      if (event.key === "Escape") event.target.blur();
      return;
    }
    if (event.key === "Escape" && state.gearSlot && (state.view === "detail" || state.view === "draft" || state.view === "compare")) {
      state.gearSlot = "";
      render();
      return;
    }
    if ((event.key === "t" || event.key === "T") && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (state.view === "tree") window.XJTree.focusSearch();
      else {
        state.view = "tree";
        render();
      }
      return;
    }
    if ((event.key === "g" || event.key === "G") && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (state.view === "gear") window.XJGear.focusSearch();
      else {
        state.view = "gear";
        render();
      }
      return;
    }
    if ((event.key === "c" || event.key === "C") && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (state.view === "card") window.XJCard.focusSearch();
      else {
        state.view = "card";
        render();
      }
      return;
    }
    if ((event.key === "s" || event.key === "S") && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (state.view === "skill") window.XJSkill.focusSearch();
      else {
        state.view = "skill";
        render();
      }
      return;
    }
    if ((event.key === "m" || event.key === "M") && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (state.view === "misc") window.XJMisc.focusSearch();
      else {
        state.view = "misc";
        render();
      }
      return;
    }
    if ((event.key === "a" || event.key === "A") && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (state.view === "ail") window.XJAil.focusSearch();
      else {
        state.view = "ail";
        render();
      }
      return;
    }
    if ((event.key === "e" || event.key === "E") && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (state.view === "affix") window.XJAffix.focusSearch();
      else {
        state.view = "affix";
        render();
      }
      return;
    }
    if (event.key === "Escape" && state.view !== "list") {
      if (state.view === "draft" && !draftHasContent(state.draft)) state.draft = null;
      state.view = "list";
      render();
    }
    if ((state.view === "detail" || state.view === "draft" || state.view === "compare") && event.key >= "1" && event.key <= "4") {
      state.page = PAGES[Number(event.key) - 1].id;
      state.gearSlot = "";
      render();
    }
  });

  Store.listBuilds().then(async (builds) => {
    state.builds = builds;
    await render();
  }).catch(() => setStatus("瀏覽器存不了資料。請用 start.bat 開啟，不要直接點 index.html。"));
})();
