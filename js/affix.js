(function (root) {
  const data = root.XJAffixData;
  if (!data) return;

  const kindName = Object.fromEntries(data.kinds.map((row) => [row.id, row.name]));
  const state = { q: "", kind: "", sel: "", folded: false };
  let host = null;
  let onKey = null;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function icon(item, className) {
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
    return `${item.name}\n${item.line || ""}\n${item.desc}\n${item.rule || ""}\n${kindName[item.kind] || ""}`.toLowerCase().includes(query);
  }

  function rows() {
    return data.items.filter(matches);
  }

  function shell() {
    return `<div class="gear-book">
      <aside class="atlas-side">
        <div class="atlas-tools"><button class="icon-btn atlas-fold" id="affix-fold" type="button" aria-expanded="true" aria-label="收合清單" title="收合清單"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6 8 12l6 6"/></svg></button></div>
        <label class="atlas-search">搜尋詞綴<input id="affix-q" type="search" placeholder="名稱、效果，例如 急襲、吸血" autocomplete="off"></label>
        <p class="hint">地圖菁英約 8% 出現，頭上用・把詞綴接起來。生命、攻擊、經驗 ×3。拉赫冰洞以前 1 個，諾可羅德火山起 2 個。尼芙菲姆到生體研究所再 +6%；深淵第 1～3 階約 21%、27%、34%。無限武鬥場固定 2 個、約 8%。卸除裝備會讓詞綴停 8 秒。組隊副本第 2 層起，寫在頭目名字後面。</p>
        <div class="gear-filters">
          <div class="gear-filter" id="affix-kinds"><span>種類</span><div class="atlas-filters">${chips(data.kinds, "data-kind", state.kind)}</div></div>
        </div>
        <p class="atlas-count" id="affix-count"></p>
        <div class="atlas-hits" id="affix-hits"></div>
      </aside>
      <article class="gear-detail" id="affix-detail"></article>
    </div>`;
  }

  function detail(item) {
    if (!item) return `<div class="gear-empty"><h2>沒有符合的詞綴</h2><p>換一個分類，或清掉搜尋字。</p></div>`;
    return `<div class="gear-head">${icon(item, "gear-hero")}<div><h2>${esc(item.name)}</h2><p class="meta">${esc(kindName[item.kind] || item.kind)} · ${esc(item.line || "")}</p></div></div>
      <p class="gear-text">${esc(item.desc)}</p>
      <section class="gear-how"><b>規則</b><p>${esc(item.rule || "")}</p></section>`;
  }

  function refresh() {
    const list = rows();
    if (!list.some((item) => item.id === state.sel)) state.sel = list[0]?.id || "";
    const focused = document.activeElement?.classList?.contains("gear-row");
    host.querySelector("#affix-count").textContent = list.length === data.items.length ? `${list.length} 種` : `${list.length} / ${data.items.length} 種`;
    host.querySelector("#affix-hits").innerHTML = list.map((item) => `<button type="button" class="gear-row" data-id="${esc(item.id)}" aria-current="${item.id === state.sel ? "true" : "false"}">
      ${icon(item, "gear-ic")}
      <span><b>${esc(item.name)}</b><small>${esc(kindName[item.kind] || "")}</small><span>${esc(item.line || item.desc)}</span></span>
    </button>`).join("") || `<p class="atlas-empty">沒有符合的詞綴。</p>`;
    host.querySelector("#affix-detail").innerHTML = detail(list.find((row) => row.id === state.sel));
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
    host.querySelector("#affix-q").addEventListener("input", (event) => {
      state.q = event.target.value;
      refresh();
    });
    host.addEventListener("click", (event) => {
      const kind = event.target.closest("#affix-kinds [data-kind]");
      const row = event.target.closest(".gear-row");
      if (kind) state.kind = kind.dataset.kind || "";
      else if (row) state.sel = row.dataset.id;
      else return;
      for (const button of host.querySelectorAll("#affix-kinds [data-kind]")) {
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
    host.querySelector("#affix-fold").addEventListener("click", () => {
      state.folded = !state.folded;
      applyFold();
    });
  }

  function applyFold() {
    host.classList.toggle("folded", state.folded);
    const button = host.querySelector("#affix-fold");
    const label = state.folded ? "展開清單" : "收合清單";
    button.setAttribute("aria-expanded", String(!state.folded));
    button.setAttribute("aria-label", label);
    button.title = label;
  }

  function mount(parent) {
    if (host?.isConnected && host.parentElement === parent) return;
    parent.innerHTML = shell();
    host = parent.querySelector(".gear-book");
    host.querySelector("#affix-q").value = state.q;
    bind();
    refresh();
    applyFold();
    if (!state.folded) host.querySelector("#affix-q").focus();
  }

  function unmount() {
    if (onKey) document.removeEventListener("keydown", onKey);
    onKey = null;
    host = null;
  }

  function focusSearch() {
    host?.querySelector("#affix-q")?.focus();
  }

  root.XJAffix = { mount, unmount, focusSearch };
})(window);
