(function (root) {
  const data = root.XJSkillAffixData;
  if (!data) return;

  const poleName = Object.fromEntries(data.poles.map((row) => [row.id, row.name]));
  const kindName = Object.fromEntries(data.kinds.map((row) => [row.id, row.name]));
  const state = { q: "", pole: "", kind: "", sel: "", folded: false };
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
    if (state.pole && item.pole !== state.pole) return false;
    if (state.kind && item.kind !== state.kind) return false;
    const query = state.q.trim().toLowerCase();
    if (!query) return true;
    return `${item.name}\n${item.line || ""}\n${item.desc}\n${item.rule || ""}\n${poleName[item.pole] || ""}\n${kindName[item.kind] || ""}`.toLowerCase().includes(query);
  }

  function rows() {
    return data.items.filter(matches);
  }

  function shell() {
    return `<div class="gear-book">
      <aside class="atlas-side">
        <div class="atlas-tools"><button class="icon-btn atlas-fold" id="saff-fold" type="button" aria-expanded="true" aria-label="收合清單" title="收合清單"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6 8 12l6 6"/></svg></button></div>
        <label class="atlas-search">搜尋技能詞綴<input id="saff-q" type="search" placeholder="名稱、效果，例如 反噬、泛用" autocomplete="off"></label>
        <p class="hint">${esc(data.note)}</p>
        <div class="gear-filters">
          <div class="gear-filter" id="saff-poles"><span>正負</span><div class="atlas-filters">${chips(data.poles, "data-pole", state.pole)}</div></div>
          <div class="gear-filter" id="saff-kinds"><span>種類</span><div class="atlas-filters">${chips(data.kinds, "data-kind", state.kind)}</div></div>
        </div>
        <p class="atlas-count" id="saff-count"></p>
        <div class="atlas-hits" id="saff-hits"></div>
      </aside>
      <article class="gear-detail" id="saff-detail"></article>
    </div>`;
  }

  function detail(item) {
    if (!item) return `<div class="gear-empty"><h2>沒有符合的詞綴</h2><p>換一個分類，或清掉搜尋字。</p></div>`;
    return `<div class="gear-head">${icon(item, "gear-hero")}<div><h2>${esc(item.name)}</h2><p class="meta">${esc(poleName[item.pole] || "")} · ${esc(kindName[item.kind] || "")}</p></div></div>
      <p class="gear-text">${esc(item.line || "")}</p>
      <section class="gear-how"><b>效果</b><p>${esc(item.desc)}</p></section>
      <section class="gear-how"><b>出現</b><p>${esc(item.rule || "")}</p></section>`;
  }

  function refresh() {
    const list = rows();
    if (!list.some((item) => item.id === state.sel)) state.sel = list[0]?.id || "";
    const focused = document.activeElement?.classList?.contains("gear-row");
    host.querySelector("#saff-count").textContent = list.length === data.items.length ? `${list.length} 種` : `${list.length} / ${data.items.length} 種`;
    host.querySelector("#saff-hits").innerHTML = list.map((item) => `<button type="button" class="gear-row" data-id="${esc(item.id)}" aria-current="${item.id === state.sel ? "true" : "false"}">
      ${icon(item, "gear-ic")}
      <span><b>${esc(item.name)}</b><small>${esc(poleName[item.pole] || "")} · ${esc(kindName[item.kind] || "")}</small><span>${esc(item.line || item.desc)}</span></span>
    </button>`).join("") || `<p class="atlas-empty">沒有符合的詞綴。</p>`;
    host.querySelector("#saff-detail").innerHTML = detail(list.find((row) => row.id === state.sel));
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
    host.querySelector("#saff-q").addEventListener("input", (event) => {
      state.q = event.target.value;
      refresh();
    });
    host.addEventListener("click", (event) => {
      const pole = event.target.closest("#saff-poles [data-pole]");
      const kind = event.target.closest("#saff-kinds [data-kind]");
      const row = event.target.closest(".gear-row");
      if (pole) state.pole = pole.dataset.pole || "";
      else if (kind) state.kind = kind.dataset.kind || "";
      else if (row) state.sel = row.dataset.id;
      else return;
      for (const button of host.querySelectorAll("#saff-poles [data-pole]")) {
        button.setAttribute("aria-pressed", button.dataset.pole === state.pole ? "true" : "false");
      }
      for (const button of host.querySelectorAll("#saff-kinds [data-kind]")) {
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
    host.querySelector("#saff-fold").addEventListener("click", () => {
      state.folded = !state.folded;
      applyFold();
    });
  }

  function applyFold() {
    host.classList.toggle("folded", state.folded);
    const button = host.querySelector("#saff-fold");
    const label = state.folded ? "展開清單" : "收合清單";
    button.setAttribute("aria-expanded", String(!state.folded));
    button.setAttribute("aria-label", label);
    button.title = label;
  }

  function mount(parent) {
    if (host?.isConnected && host.parentElement === parent) return;
    parent.innerHTML = shell();
    host = parent.querySelector(".gear-book");
    host.querySelector("#saff-q").value = state.q;
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
    host?.querySelector("#saff-q")?.focus();
  }

  root.XJSkillAffix = { mount, unmount, focusSearch };
})(window);
