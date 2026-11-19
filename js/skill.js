(function (root) {
  const data = root.XJSkillData;
  if (!data) return;

  const ICON = "https://www.xianjing.dev/assets/ro/skills/";
  const className = Object.fromEntries(data.classes.map((row) => [row.id, row.name]));
  const kindName = Object.fromEntries(data.kinds.map((row) => [row.id, row.name]));
  const elementName = Object.fromEntries(data.elements.map((row) => [row.id, row.name]));
  const tagName = Object.fromEntries(data.tags.map((row) => [row.id, row.name]));
  const state = { q: "", cls: "", kind: "", tag: "", sel: "", folded: false, tagsOpen: false };
  const DROP = 3e-5;
  const SHUTTLE = 1e-4;
  const channels = [
    ["一般怪", DROP, SHUTTLE],
    ["菁英", DROP * 5, SHUTTLE],
    ["頭目、MVP", DROP * 50, SHUTTLE],
    ["魔王戰", DROP * 50 / 3, SHUTTLE / 3],
    ["闇答萊屍", 0.075, null],
    ["組隊每層", 0.056, null],
  ];
  let host = null;
  let onKey = null;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function icon(item, className) {
    return `<img class="${className}" alt="" src="${ICON}${encodeURIComponent(item.icon)}.png" draggable="false">`;
  }

  function chips(rows, attr, current) {
    const buttons = [`<button type="button" ${attr}="" aria-pressed="${current === "" ? "true" : "false"}">全部</button>`];
    for (const row of rows) {
      buttons.push(`<button type="button" ${attr}="${row.id}" aria-pressed="${current === row.id ? "true" : "false"}">${esc(row.name)}</button>`);
    }
    return buttons.join("");
  }

  function filterGroup(id, label, rows, attr, current) {
    return `<div class="gear-filter" id="${id}"><span>${label}</span><div class="atlas-filters">${chips(rows, attr, current)}</div></div>`;
  }

  function pct(rate) {
    const value = rate * 100;
    return `${value.toFixed(value >= 1 ? 1 : 4).replace(/\.?0+$/, "")}%`;
  }

  function acquireCard() {
    const rows = channels.map(([name, mut, shuttle]) => `<li><span>${name}</span><b>${pct(mut)} / ${shuttle == null ? "—" : pct(shuttle)}</b></li>`).join("");
    return `<section class="skill-acquire" aria-label="取得管道"><b>取得管道</b><small>變異 / 穿梭</small><ul>${rows}</ul><p>各地圖單隻相同。穿梭不吃菁英、頭目倍率，魔王戰再 ×1/3。商店每顆 200 Zeny。</p></section>`;
  }

  function tagGroup() {
    return `<div class="gear-filter${state.tagsOpen ? "" : " folded"}" id="skill-tags">
      <button class="tag-fold" id="skill-tags-fold" type="button" aria-expanded="${state.tagsOpen ? "true" : "false"}" aria-controls="skill-tag-list">
        <span>標籤</span><small id="skill-tag-now"></small>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div class="atlas-filters" id="skill-tag-list">${chips(data.tags, "data-tag", state.tag)}</div>
    </div>`;
  }

  function matches(item, { tag = true } = {}) {
    if (state.cls && !(item.uses || []).includes(state.cls)) return false;
    if (state.kind && item.kind !== state.kind) return false;
    if (tag && state.tag && !(item.tags || []).includes(state.tag)) return false;
    const query = state.q.trim().toLowerCase();
    if (!query) return true;
    const tags = (item.tags || []).map((id) => tagName[id] || id).join("\n");
    const users = (item.uses || []).map((id) => className[id] || id).join("\n");
    return `${item.name}\n${item.desc}\n${className[item.cls] || ""}\n${kindName[item.kind] || ""}\n${tags}\n${users}`.toLowerCase().includes(query);
  }

  function rowsFor(options) {
    return data.items.filter((item) => matches(item, options));
  }

  function line(item) {
    const bits = [className[item.cls] || item.cls, kindName[item.kind] || item.kind, `${item.shape.length} 格`];
    if (item.kind === "skill" && item.cd > 0) bits.push(`${item.cd} 秒`);
    return bits.join(" · ");
  }

  function shapeHtml(item) {
    const width = Math.max(...item.shape.map((cell) => cell[0]), 0) + 1;
    const height = Math.max(...item.shape.map((cell) => cell[1]), 0) + 1;
    const cells = item.shape.map(([x, y]) => `<i style="grid-column:${x + 1};grid-row:${y + 1}"></i>`).join("");
    return `<div class="skill-shape" style="grid-template-columns:repeat(${width},22px);grid-template-rows:repeat(${height},22px)">${cells}</div>`;
  }

  function shell() {
    return `<div class="gear-book">
      <aside class="atlas-side">
        <div class="atlas-tools"><button class="icon-btn atlas-fold" id="skill-fold" type="button" aria-expanded="true" aria-label="收合清單" title="收合清單"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6 8 12l6 6"/></svg></button></div>
        <label class="atlas-search">搜尋技能<input id="skill-q" type="search" placeholder="名稱、效果、職業、標籤" autocomplete="off"></label>
        <p class="hint">數值是 1 級寶石。選職業時，會一併列出那個職業能用的其他職業輔助。</p>
        <div class="gear-filters">
          ${filterGroup("skill-classes", "職業", data.classes, "data-cls", state.cls)}
          ${filterGroup("skill-kinds", "種類", data.kinds, "data-kind", state.kind)}
          ${tagGroup()}
        </div>
        ${acquireCard()}
        <p class="atlas-count" id="skill-count"></p>
        <div class="atlas-hits" id="skill-hits"></div>
      </aside>
      <article class="gear-detail" id="skill-detail"></article>
    </div>`;
  }

  function sync(group, attr, value) {
    for (const button of host.querySelectorAll(group)) {
      button.setAttribute("aria-pressed", button.getAttribute(attr) === value ? "true" : "false");
    }
  }

  function detail(item) {
    if (!item) return `<div class="gear-empty"><h2>沒有符合的技能</h2><p>換一個分類，或清掉搜尋字。</p></div>`;
    const facts = [`${item.shape.length} 格`];
    if (item.kind === "skill" && item.cd > 0) facts.push(`冷卻 ${item.cd} 秒`);
    if (item.mult) facts.push(`倍率 ${Math.round(item.mult * 1000) / 10}%`);
    if (item.unlock) facts.push(`Lv ${item.unlock} 解鎖`);
    if (item.element) facts.push(`${elementName[item.element] || item.element}屬性`);
    if (item.tags?.length) facts.push(`標籤 ${item.tags.map((id) => tagName[id] || id).join("、")}`);
    const users = (item.uses || []).map((id) => className[id] || id);
    const who = users.length > 1 ? `${users.join("、")}都能放上技能盤。` : `${users[0] || "這個職業"}專用。`;
    return `<div class="gear-head">${icon(item, "gear-hero")}<div><h2>${esc(item.name)}</h2><p class="meta">${esc(line(item))}</p></div></div>
      <p class="gear-text">${esc(item.desc)}</p>
      <section class="gear-how"><b>寶石</b><p>${esc(facts.join("。"))}。</p></section>
      <h3>形狀</h3>${shapeHtml(item)}
      <p class="hint">${esc(who)}</p>`;
  }

  function refresh() {
    const base = rowsFor({ tag: false });
    const present = new Set(base.flatMap((item) => item.tags || []));
    if (state.tag && !present.has(state.tag)) state.tag = "";
    host.querySelector("#skill-tag-list").innerHTML = chips(data.tags.filter((tag) => present.has(tag.id)), "data-tag", state.tag);
    applyTags();
    const rows = state.tag ? base.filter((item) => (item.tags || []).includes(state.tag)) : base;
    if (!rows.some((item) => item.id === state.sel)) state.sel = rows[0]?.id || "";
    const focused = document.activeElement?.classList?.contains("gear-row");
    host.querySelector("#skill-count").textContent = rows.length === data.items.length ? `${rows.length} 顆` : `${rows.length} / ${data.items.length} 顆`;
    host.querySelector("#skill-hits").innerHTML = rows.map((item) => `<button type="button" class="gear-row" data-id="${esc(item.id)}" aria-current="${item.id === state.sel ? "true" : "false"}">
      ${icon(item, "gear-ic")}
      <span><b>${esc(item.name)}</b><small>${esc(line(item))}</small><span>${esc(item.desc)}</span></span>
    </button>`).join("") || `<p class="atlas-empty">沒有符合的技能。</p>`;
    host.querySelector("#skill-detail").innerHTML = detail(rows.find((row) => row.id === state.sel));
    host.querySelector(".gear-row[aria-current='true']")?.scrollIntoView({ block: "nearest" });
    if (focused) host.querySelector(".gear-row[aria-current='true']")?.focus();
  }

  function move(step) {
    const rows = rowsFor();
    const index = Math.max(0, rows.findIndex((item) => item.id === state.sel));
    const next = rows[Math.max(0, Math.min(rows.length - 1, index + step))];
    if (!next || next.id === state.sel) return;
    state.sel = next.id;
    refresh();
  }

  function bind() {
    host.querySelector("#skill-q").addEventListener("input", (event) => {
      state.q = event.target.value;
      refresh();
    });
    host.addEventListener("click", (event) => {
      if (event.target.closest("#skill-tags-fold")) {
        state.tagsOpen = !state.tagsOpen;
        applyTags();
        return;
      }
      const cls = event.target.closest("#skill-classes [data-cls]");
      const kind = event.target.closest("#skill-kinds [data-kind]");
      const tag = event.target.closest("#skill-tags [data-tag]");
      const row = event.target.closest(".gear-row");
      if (cls) state.cls = cls.dataset.cls || "";
      else if (kind) state.kind = kind.dataset.kind || "";
      else if (tag) state.tag = tag.dataset.tag || "";
      else if (row) state.sel = row.dataset.id;
      else return;
      sync("#skill-classes [data-cls]", "data-cls", state.cls);
      sync("#skill-kinds [data-kind]", "data-kind", state.kind);
      refresh();
    });
    onKey = (event) => {
      if (!host?.isConnected) return;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (event.target.matches("textarea, select")) return;
      event.preventDefault();
      move(event.key === "ArrowDown" ? 1 : -1);
    };
    document.addEventListener("keydown", onKey);
    host.querySelector("#skill-fold").addEventListener("click", () => {
      state.folded = !state.folded;
      applyFold();
    });
  }

  function applyTags() {
    const box = host.querySelector("#skill-tags");
    const button = host.querySelector("#skill-tags-fold");
    box.classList.toggle("folded", !state.tagsOpen);
    button.setAttribute("aria-expanded", String(state.tagsOpen));
    host.querySelector("#skill-tag-now").textContent = state.tag ? tagName[state.tag] || state.tag : "";
  }

  function applyFold() {
    host.classList.toggle("folded", state.folded);
    const button = host.querySelector("#skill-fold");
    const label = state.folded ? "展開清單" : "收合清單";
    button.setAttribute("aria-expanded", String(!state.folded));
    button.setAttribute("aria-label", label);
    button.title = label;
  }

  function mount(parent) {
    if (host?.isConnected && host.parentElement === parent) return;
    parent.innerHTML = shell();
    host = parent.querySelector(".gear-book");
    host.querySelector("#skill-q").value = state.q;
    bind();
    refresh();
    applyFold();
  }

  function unmount() {
    if (onKey) document.removeEventListener("keydown", onKey);
    onKey = null;
    host = null;
  }

  function focusSearch() {
    host?.querySelector("#skill-q")?.focus();
  }

  root.XJSkill = { mount, unmount, focusSearch };
})(window);
