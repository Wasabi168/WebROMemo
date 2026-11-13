(function (root) {
  const data = root.XJGearData;
  if (!data) return;

  const ICON = "https://www.xianjing.dev/assets/ro/items/";
  const state = { q: "", slot: "", kind: "", source: "", sel: "", folded: false };
  let host = null;
  let onKey = null;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function icon(id, className) {
    if (!id) return `<span class="${className} gear-ph" aria-hidden="true"></span>`;
    return `<img class="${className}" alt="" src="${ICON}${encodeURIComponent(id)}.png" draggable="false">`;
  }

  function filterGroup(id, label, rows, attr, current) {
    return `<div class="gear-filter" id="${id}"><span>${label}</span><div class="atlas-filters">${chips(rows, attr, current, "全部")}</div></div>`;
  }

  function chips(rows, attr, current, all) {
    const buttons = [`<button type="button" ${attr}="" aria-pressed="${current === "" ? "true" : "false"}">${all}</button>`];
    for (const row of rows) {
      buttons.push(`<button type="button" ${attr}="${row.id}" aria-pressed="${current === row.id ? "true" : "false"}">${esc(row.name)}</button>`);
    }
    return buttons.join("");
  }

  function results() {
    const query = state.q.trim().toLowerCase();
    return data.items.filter((item) => {
      if (state.slot && item.slot !== state.slot) return false;
      if (state.kind && item.kind !== state.kind) return false;
      if (state.source && item.source !== state.source) return false;
      if (!query) return true;
      return `${item.name}\n${item.line}\n${item.text}\n${item.how}\n${item.note || ""}`.toLowerCase().includes(query);
    });
  }

  function shell() {
    return `<div class="gear-book">
      <aside class="atlas-side">
        <div class="atlas-tools"><button class="icon-btn atlas-fold" id="gear-fold" type="button" aria-expanded="true" aria-label="收合清單" title="收合清單"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6 8 12l6 6"/></svg></button></div>
        <label class="atlas-search">搜尋裝備<input id="gear-q" type="search" placeholder="名稱、效果、職業、取得管道" autocomplete="off"></label>
        <p class="hint">基底是地圖掉落的裝備名稱，詞綴另外隨機。獨特才有固定效果。</p>
        <div class="gear-filters">
          ${filterGroup("gear-slots", "部位", data.slots, "data-slot", state.slot)}
          ${filterGroup("gear-kinds", "種類", data.kinds, "data-kind", state.kind)}
          ${filterGroup("gear-sources", "來源", data.sources, "data-source", state.source)}
        </div>
        <p class="atlas-count" id="gear-count"></p>
        <div class="atlas-hits" id="gear-hits"></div>
      </aside>
      <article class="gear-detail" id="gear-detail"></article>
    </div>`;
  }

  function sync(group, attr, value) {
    for (const button of host.querySelectorAll(group)) {
      button.setAttribute("aria-pressed", button.getAttribute(attr) === value ? "true" : "false");
    }
  }

  function refresh() {
    const rows = results();
    if (!rows.some((item) => item.id === state.sel)) state.sel = rows[0]?.id || "";
    const focused = document.activeElement?.classList?.contains("gear-row");
    host.querySelector("#gear-count").textContent = rows.length === data.items.length ? `${rows.length} 件` : `${rows.length} / ${data.items.length} 件`;
    host.querySelector("#gear-hits").innerHTML = rows.map((item) => `<button type="button" class="gear-row" data-id="${esc(item.id)}" aria-current="${item.id === state.sel ? "true" : "false"}">
      ${icon(item.icon, "gear-ic")}
      <span><b>${esc(item.name)}</b><small>${esc(item.line)}</small><span>${esc(item.text)}</span></span>
    </button>`).join("") || `<p class="atlas-empty">沒有符合的裝備。</p>`;
    const item = rows.find((row) => row.id === state.sel);
    host.querySelector("#gear-detail").innerHTML = item ? `<div class="gear-head">${icon(item.icon, "gear-hero")}<div><h2>${esc(item.name)}</h2><p class="meta">${esc(item.line)}</p></div></div>
      <p class="gear-text">${esc(item.text)}</p>
      <section class="gear-how"><b>取得管道</b><p>${esc(item.how)}</p></section>
      ${item.note ? `<p class="hint">${esc(item.note)}</p>` : ""}` : `<div class="gear-empty"><h2>沒有符合的裝備</h2><p>換一個分類，或清掉搜尋字。</p></div>`;
    host.querySelector(".gear-row[aria-current='true']")?.scrollIntoView({ block: "nearest" });
    if (focused) host.querySelector(".gear-row[aria-current='true']")?.focus();
  }

  function move(step) {
    const rows = results();
    const index = Math.max(0, rows.findIndex((item) => item.id === state.sel));
    const next = rows[Math.max(0, Math.min(rows.length - 1, index + step))];
    if (!next || next.id === state.sel) return;
    state.sel = next.id;
    refresh();
  }

  function bind() {
    host.querySelector("#gear-q").addEventListener("input", (event) => {
      state.q = event.target.value;
      refresh();
    });
    host.addEventListener("click", (event) => {
      const slot = event.target.closest("#gear-slots [data-slot]");
      const kind = event.target.closest("#gear-kinds [data-kind]");
      const source = event.target.closest("#gear-sources [data-source]");
      const row = event.target.closest(".gear-row");
      if (slot) state.slot = slot.dataset.slot || "";
      else if (kind) state.kind = kind.dataset.kind || "";
      else if (source) state.source = source.dataset.source || "";
      else if (row) state.sel = row.dataset.id;
      else return;
      sync("#gear-slots [data-slot]", "data-slot", state.slot);
      sync("#gear-kinds [data-kind]", "data-kind", state.kind);
      sync("#gear-sources [data-source]", "data-source", state.source);
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
    host.querySelector("#gear-fold").addEventListener("click", () => {
      state.folded = !state.folded;
      applyFold();
    });
  }

  function applyFold() {
    host.classList.toggle("folded", state.folded);
    const button = host.querySelector("#gear-fold");
    const label = state.folded ? "展開清單" : "收合清單";
    button.setAttribute("aria-expanded", String(!state.folded));
    button.setAttribute("aria-label", label);
    button.title = label;
  }

  function mount(parent) {
    if (host?.isConnected && host.parentElement === parent) return;
    parent.innerHTML = shell();
    host = parent.querySelector(".gear-book");
    host.querySelector("#gear-q").value = state.q;
    bind();
    refresh();
    applyFold();
    if (!state.folded) host.querySelector("#gear-q").focus();
  }

  function unmount() {
    if (onKey) document.removeEventListener("keydown", onKey);
    onKey = null;
    host = null;
  }

  function focusSearch() {
    host?.querySelector("#gear-q")?.focus();
  }

  root.XJGear = { mount, unmount, focusSearch };
})(window);
