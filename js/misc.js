(function (root) {
  const data = root.XJMiscData;
  if (!data) return;

  const ICON = "https://www.xianjing.dev/assets/ro/items/";
  const kindName = Object.fromEntries(data.kinds.map((row) => [row.id, row.name]));
  const state = { q: "", kind: "", sel: "", folded: false };
  let host = null;
  let onKey = null;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function icon(item, className) {
    if (item.icon) return `<img class="${className}" alt="" src="${ICON}${encodeURIComponent(item.icon)}.png" draggable="false">`;
    return `<span class="${className} misc-swatch" style="background:${esc(item.color || "#8a7968")}"></span>`;
  }

  function chips(rows, attr, current) {
    const buttons = [`<button type="button" ${attr}="" aria-pressed="${current === "" ? "true" : "false"}">全部</button>`];
    for (const row of rows) {
      buttons.push(`<button type="button" ${attr}="${row.id}" aria-pressed="${current === row.id ? "true" : "false"}">${esc(row.name)}</button>`);
    }
    return buttons.join("");
  }

  function matches(item) {
    if (state.kind && item.kind !== state.kind) return false;
    const query = state.q.trim().toLowerCase();
    if (!query) return true;
    return `${item.name}\n${item.desc}\n${item.how}\n${item.note || ""}\n${kindName[item.kind] || ""}`.toLowerCase().includes(query);
  }

  function rows() {
    return data.items.filter(matches);
  }

  function shell() {
    return `<div class="gear-book">
      <aside class="atlas-side">
        <div class="atlas-tools"><button class="icon-btn atlas-fold" id="misc-fold" type="button" aria-expanded="true" aria-label="收合清單" title="收合清單"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6 8 12l6 6"/></svg></button></div>
        <label class="atlas-search">搜尋雜物<input id="misc-q" type="search" placeholder="名稱、用途、掉落" autocomplete="off"></label>
        <p class="hint">素材、門票、信物、碎片和卷軸跟著帳號。生命藥水跟著角色；增益藥水在成就頁，也是帳號共用。</p>
        <div class="gear-filters">
          <div class="gear-filter" id="misc-kinds"><span>種類</span><div class="atlas-filters">${chips(data.kinds, "data-kind", state.kind)}</div></div>
        </div>
        <p class="atlas-count" id="misc-count"></p>
        <div class="atlas-hits" id="misc-hits"></div>
      </aside>
      <article class="gear-detail" id="misc-detail"></article>
    </div>`;
  }

  function detail(item) {
    if (!item) return `<div class="gear-empty"><h2>沒有符合的雜物</h2><p>換一個分類，或清掉搜尋字。</p></div>`;
    const note = item.note ? `<p class="hint">${esc(item.note)}</p>` : "";
    return `<div class="gear-head">${icon(item, "gear-hero")}<div><h2>${esc(item.name)}</h2><p class="meta">${esc(kindName[item.kind] || item.kind)}</p></div></div>
      <p class="gear-text">${esc(item.desc)}</p>
      <section class="gear-how"><b>取得</b><p>${esc(item.how)}</p></section>
      ${note}`;
  }

  function refresh() {
    const list = rows();
    if (!list.some((item) => item.id === state.sel)) state.sel = list[0]?.id || "";
    const focused = document.activeElement?.classList?.contains("gear-row");
    host.querySelector("#misc-count").textContent = list.length === data.items.length ? `${list.length} 種` : `${list.length} / ${data.items.length} 種`;
    host.querySelector("#misc-hits").innerHTML = list.map((item) => `<button type="button" class="gear-row" data-id="${esc(item.id)}" aria-current="${item.id === state.sel ? "true" : "false"}">
      ${icon(item, "gear-ic")}
      <span><b>${esc(item.name)}</b><small>${esc(kindName[item.kind] || "")}</small><span>${esc(item.desc)}</span></span>
    </button>`).join("") || `<p class="atlas-empty">沒有符合的雜物。</p>`;
    host.querySelector("#misc-detail").innerHTML = detail(list.find((row) => row.id === state.sel));
    host.querySelector(".gear-row[aria-current='true']")?.scrollIntoView({ block: "nearest" });
    if (focused) host.querySelector(".gear-row[aria-current='true']")?.focus();
  }

  function move(step) {
    const list = rows();
    const index = Math.max(0, list.findIndex((item) => item.id === state.sel));
    const next = list[Math.max(0, Math.min(list.length - 1, index + step))];
    if (!next || next.id === state.sel) return;
    state.sel = next.id;
    refresh();
  }

  function bind() {
    host.querySelector("#misc-q").addEventListener("input", (event) => {
      state.q = event.target.value;
      refresh();
    });
    host.addEventListener("click", (event) => {
      const kind = event.target.closest("#misc-kinds [data-kind]");
      const row = event.target.closest(".gear-row");
      if (kind) state.kind = kind.dataset.kind || "";
      else if (row) state.sel = row.dataset.id;
      else return;
      for (const button of host.querySelectorAll("#misc-kinds [data-kind]")) {
        button.setAttribute("aria-pressed", button.dataset.kind === state.kind ? "true" : "false");
      }
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
    host.querySelector("#misc-fold").addEventListener("click", () => {
      state.folded = !state.folded;
      applyFold();
    });
  }

  function applyFold() {
    host.classList.toggle("folded", state.folded);
    const button = host.querySelector("#misc-fold");
    const label = state.folded ? "展開清單" : "收合清單";
    button.setAttribute("aria-expanded", String(!state.folded));
    button.setAttribute("aria-label", label);
    button.title = label;
  }

  function mount(parent) {
    if (host?.isConnected && host.parentElement === parent) return;
    parent.innerHTML = shell();
    host = parent.querySelector(".gear-book");
    host.querySelector("#misc-q").value = state.q;
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
    host?.querySelector("#misc-q")?.focus();
  }

  root.XJMisc = { mount, unmount, focusSearch };
})(window);
