(function (root) {
  const data = root.XJCardData;
  if (!data) return;

  const state = { q: "", tier: "", slot: "", sel: "", folded: false };
  const tierOf = Object.fromEntries(data.tiers.map((row) => [row.id, row]));
  const blob = new Map();
  for (const item of data.items) {
    const pack = data.acquire[item.tier];
    const places = [...pack.map, ...pack.other].map((row) => `${row.place}\n${row.note}`).join("\n");
    blob.set(item.id, `${item.name}\n${item.text}\n${item.slotName}\n${tierOf[item.tier].name}\n${places}`.toLowerCase());
  }

  let host = null;
  let onKey = null;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function filterGroup(id, label, rows, attr, current) {
    return `<div class="gear-filter" id="${id}"><span>${label}</span><div class="atlas-filters">${chips(rows, attr, current)}</div></div>`;
  }

  function chips(rows, attr, current) {
    const buttons = [`<button type="button" ${attr}="" aria-pressed="${current === "" ? "true" : "false"}">全部</button>`];
    for (const row of rows) {
      const dot = row.color ? `<i class="route-dot" style="background:${row.color}"></i>` : "";
      buttons.push(`<button type="button" ${attr}="${row.id}" aria-pressed="${current === row.id ? "true" : "false"}">${dot}${esc(row.name)}</button>`);
    }
    return buttons.join("");
  }

  function badge(item, large) {
    const tier = tierOf[item.tier];
    return `<span class="card-badge${large ? " lg" : ""}" style="background:${tier.color};color:${tier.ink}">${esc(tier.name.slice(0, 1))}</span>`;
  }

  function results() {
    const query = state.q.trim().toLowerCase();
    return data.items.filter((item) => {
      if (state.tier && item.tier !== state.tier) return false;
      if (state.slot && item.slot !== state.slot) return false;
      if (!query) return true;
      return blob.get(item.id).includes(query);
    });
  }

  function shell() {
    return `<div class="gear-book">
      <aside class="atlas-side">
        <div class="atlas-tools"><button class="icon-btn atlas-fold" id="card-fold" type="button" aria-expanded="true" aria-label="收合清單" title="收合清單"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6 8 12l6 6"/></svg></button></div>
        <label class="atlas-search">搜尋卡片<input id="card-q" type="search" placeholder="名稱、效果、地圖、副本" autocomplete="off"></label>
        <p class="hint">卡片沒有各自的怪物。掉落先抽階級，再從同階裡平均抽一張。</p>
        <div class="gear-filters">
          ${filterGroup("card-tiers", "階級", data.tiers, "data-tier", state.tier)}
          ${filterGroup("card-slots", "部位", data.slots, "data-slot", state.slot)}
        </div>
        <p class="atlas-count" id="card-count"></p>
        <div class="atlas-hits" id="card-hits"></div>
      </aside>
      <article class="gear-detail" id="card-detail"></article>
    </div>`;
  }

  function sync(group, attr, value) {
    for (const button of host.querySelectorAll(group)) {
      button.setAttribute("aria-pressed", button.getAttribute(attr) === value ? "true" : "false");
    }
  }

  function table(rows) {
    if (!rows.length) return "";
    const body = rows.map((row) => `<tr>
      <td><b>${esc(row.place)}</b><small>${esc(row.note)}</small></td>
      <td>${esc(row.drop)}</td>
      <td>${esc(row.share)}</td>
      <td>${esc(row.each)}</td>
    </tr>`).join("");
    return `<div class="card-scroll"><table class="card-rates"><thead><tr><th>地方</th><th>掉出一張卡</th><th>這個階級</th><th>這張卡</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }

  function detail(item) {
    if (!item) return `<div class="gear-empty"><h2>沒有符合的卡片</h2><p>換一個分類，或清掉搜尋字。</p></div>`;
    const pack = data.acquire[item.tier];
    const tier = tierOf[item.tier];
    const notes = [];
    if (Number(item.tier) <= 3) notes.push(data.sym);
    if (item.tier !== "6") notes.push(data.abyss);
    notes.push(data.fuse);
    return `<div class="gear-head">${badge(item, true)}<div><h2>${esc(item.name)}</h2><p class="meta">${esc(tier.name)} · ${esc(item.slotName)} · 同階 ${tier.count} 張</p></div></div>
      <p class="gear-text">${esc(item.text)}</p>
      <section class="gear-how"><b>取得</b><p>${esc(pack.lead)}</p></section>
      ${pack.map.length ? `<h3>地圖</h3>${table(pack.map)}` : ""}
      ${pack.other.length ? `<h3>指定內容</h3>${table(pack.other)}` : ""}
      ${notes.map((text) => `<p class="hint">${esc(text)}</p>`).join("")}`;
  }

  function refresh() {
    const rows = results();
    if (!rows.some((item) => item.id === state.sel)) state.sel = rows[0]?.id || "";
    const focused = document.activeElement?.classList?.contains("gear-row");
    host.querySelector("#card-count").textContent = rows.length === data.items.length ? `${rows.length} 張` : `${rows.length} / ${data.items.length} 張`;
    host.querySelector("#card-hits").innerHTML = rows.map((item) => `<button type="button" class="gear-row" data-id="${esc(item.id)}" aria-current="${item.id === state.sel ? "true" : "false"}">
      ${badge(item)}
      <span><b>${esc(item.name)}</b><small>${esc(tierOf[item.tier].name)} · ${esc(item.slotName)}</small><span>${esc(item.text)}</span></span>
    </button>`).join("") || `<p class="atlas-empty">沒有符合的卡片。</p>`;
    const item = rows.find((row) => row.id === state.sel);
    host.querySelector("#card-detail").innerHTML = detail(item);
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
    host.querySelector("#card-q").addEventListener("input", (event) => {
      state.q = event.target.value;
      refresh();
    });
    host.addEventListener("click", (event) => {
      const tier = event.target.closest("#card-tiers [data-tier]");
      const slot = event.target.closest("#card-slots [data-slot]");
      const row = event.target.closest(".gear-row");
      if (tier) state.tier = tier.dataset.tier || "";
      else if (slot) state.slot = slot.dataset.slot || "";
      else if (row) state.sel = row.dataset.id;
      else return;
      sync("#card-tiers [data-tier]", "data-tier", state.tier);
      sync("#card-slots [data-slot]", "data-slot", state.slot);
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
    host.querySelector("#card-fold").addEventListener("click", () => {
      state.folded = !state.folded;
      applyFold();
    });
  }

  function applyFold() {
    host.classList.toggle("folded", state.folded);
    const button = host.querySelector("#card-fold");
    const label = state.folded ? "展開清單" : "收合清單";
    button.setAttribute("aria-expanded", String(!state.folded));
    button.setAttribute("aria-label", label);
    button.title = label;
  }

  function mount(parent) {
    if (host?.isConnected && host.parentElement === parent) return;
    parent.innerHTML = shell();
    host = parent.querySelector(".gear-book");
    host.querySelector("#card-q").value = state.q;
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
    host?.querySelector("#card-q")?.focus();
  }

  root.XJCard = { mount, unmount, focusSearch };
})(window);
