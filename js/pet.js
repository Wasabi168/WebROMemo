(function (root) {
  const data = root.XJPetData;
  if (!data) return;

  const ICON = "https://www.xianjing.dev/assets/ro/pets/";
  const tierOf = Object.fromEntries(data.tiers.map((row) => [row.id, row]));
  const statOrder = Object.keys(data.stats);
  const flat = new Set(data.flat);
  const state = { q: "", tier: "", sel: "", folded: false };
  let host = null;
  let onKey = null;

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function pct(value) {
    const digits = value >= 0.1 ? 2 : 3;
    return value.toFixed(digits).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  }

  function scaled(mods, star) {
    const factor = 1 + data.starStep * (star - 1);
    const out = {};
    for (const [key, value] of Object.entries(mods)) out[key] = Math.round(value * factor * 100) / 100;
    return out;
  }

  function modText(mods) {
    return statOrder.filter((key) => mods[key] != null).map((key) => {
      const suffix = flat.has(key) ? "" : "%";
      return `${data.stats[key] || key} +${mods[key]}${suffix}`;
    }).join("、");
  }

  function chance(item) {
    const tier = tierOf[item.tier];
    return tier.w / tier.n;
  }

  function art(item, size) {
    const scale = Math.min(1.6, size / Math.max(item.frame.w, item.frame.h));
    const frame = item.frame;
    return `<span class="pet-art ${size > 40 ? "gear-hero" : "gear-ic"}" aria-hidden="true"><i style="width:${frame.w}px;height:${frame.h}px;background-image:url('${ICON}${encodeURIComponent(item.id)}.webp');background-position:0 -${frame.y}px;transform:translate(-50%,-50%) scale(${scale.toFixed(3)})"></i></span>`;
  }

  function chips() {
    const buttons = [`<button type="button" data-tier="" aria-pressed="${state.tier === "" ? "true" : "false"}">全部</button>`];
    for (const row of data.tiers) {
      buttons.push(`<button type="button" data-tier="${row.id}" aria-pressed="${state.tier === row.id ? "true" : "false"}"><i class="route-dot" style="background:${row.color}"></i>${esc(row.name)}</button>`);
    }
    return buttons.join("");
  }

  function matches(item) {
    if (state.tier && item.tier !== state.tier) return false;
    const query = state.q.trim().toLowerCase();
    if (!query) return true;
    const tier = tierOf[item.tier];
    const blob = [item.name, tier.name, modText(item.mods), modText(scaled(item.mods, data.maxStar))].join("\n");
    return blob.toLowerCase().includes(query);
  }

  function rows() {
    return data.items.filter(matches);
  }

  function shell() {
    return `<div class="gear-book">
      <aside class="atlas-side">
        <div class="atlas-tools"><button class="icon-btn atlas-fold" id="pet-fold" type="button" aria-expanded="true" aria-label="收合清單" title="收合清單"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6 8 12l6 6"/></svg></button></div>
        <label class="atlas-search">搜尋寵物<input id="pet-q" type="search" placeholder="名稱、加成，例如 波利、暴擊" autocomplete="off"></label>
        <p class="hint">到吉芬找寵物飼育員。圖鑑、星級、碎片和扭蛋券跟著帳號；出戰的是哪一隻跟著角色，同時只能一隻。寵物不攻擊，加成直接加在角色上。</p>
        <div class="gear-filters">
          <div class="gear-filter" id="pet-tiers"><span>階級</span><div class="atlas-filters">${chips()}</div></div>
        </div>
        <p class="atlas-count" id="pet-count"></p>
        <div class="atlas-hits" id="pet-hits"></div>
      </aside>
      <article class="gear-detail" id="pet-detail"></article>
    </div>`;
  }

  function starRows(item) {
    const body = [];
    for (let star = 1; star <= data.maxStar; star += 1) {
      body.push(`<tr><td>★${star}</td><td>${esc(modText(scaled(item.mods, star)))}</td></tr>`);
    }
    return `<div class="card-scroll"><table class="card-rates"><thead><tr><th>星級</th><th>加成</th></tr></thead><tbody>${body.join("")}</tbody></table></div>`;
  }

  function detail(item) {
    if (!item) return `<div class="gear-empty"><h2>沒有符合的寵物</h2><p>換一個階級，或清掉搜尋字。</p></div>`;
    const tier = tierOf[item.tier];
    const each = pct(chance(item));
    const pityNames = data.pityTiers.map((id) => tierOf[id].name);
    const pityLabel = `${pityNames.slice(0, -1).join("、")}或${pityNames.at(-1)}`;
    const pityW = data.pityW.join("、");
    const star2 = Math.round((1 + data.starStep) * 100) / 100;
    const star3 = Math.round((1 + data.starStep * 2) * 100) / 100;
    return `<div class="gear-head">${art(item, 72)}<div><h2>${esc(item.name)}</h2><p class="meta"><i class="route-dot" style="background:${esc(tier.color)}"></i>${esc(tier.name)} · 每抽約 ${each}%</p></div></div>
      <p class="gear-text">出戰後加在這個角色上。滿星是${esc(modText(scaled(item.mods, data.maxStar)))}。</p>
      <section class="gear-how"><b>星級</b>${starRows(item)}<p>同一隻抽到第 ${data.maxStar} 次升到 ★${data.maxStar}。以 ★1 為準，★2 乘 ${star2}、★3 乘 ${star3}，四捨五入到小數第二位。暴擊率、冷卻縮減和全屬性抗性直接加點，其餘是百分比。</p></section>
      <section class="gear-how"><b>取得</b><p>${esc(tier.name)}每抽 ${pct(tier.w)}%。抽到這一階後 ${tier.n} 隻平均分，所以這隻約 ${each}%。★${data.maxStar} 之後再抽到同一隻，改得 1 個碎片，${data.shardPerTicket} 個碎片換 1 張扭蛋券。</p></section>
      <p class="hint">扭蛋券從組隊副本每層 ${pct(data.ticketRate * 100)}% 掉落，帳號共用，最多 ${data.ticketMax.toLocaleString()} 張。十連若 10 抽都低於稀有，第 10 抽改抽${pityLabel}（權重 ${pityW}）。神話不參與保底。</p>`;
  }

  function refresh() {
    const list = rows();
    if (!list.some((item) => item.id === state.sel)) state.sel = list[0]?.id || "";
    const focused = document.activeElement?.classList?.contains("gear-row");
    host.querySelector("#pet-count").textContent = list.length === data.items.length ? `${list.length} 隻` : `${list.length} / ${data.items.length} 隻`;
    host.querySelector("#pet-hits").innerHTML = list.map((item) => {
      const tier = tierOf[item.tier];
      return `<button type="button" class="gear-row" data-id="${esc(item.id)}" aria-current="${item.id === state.sel ? "true" : "false"}">
        ${art(item, 40)}
        <span><b>${esc(item.name)}</b><small>${esc(tier.name)} · 約 ${pct(chance(item))}%</small><span>${esc(modText(item.mods))}</span></span>
      </button>`;
    }).join("") || `<p class="atlas-empty">沒有符合的寵物。</p>`;
    host.querySelector("#pet-detail").innerHTML = detail(list.find((row) => row.id === state.sel));
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
    host.querySelector("#pet-q").addEventListener("input", (event) => {
      state.q = event.target.value;
      refresh();
    });
    host.addEventListener("click", (event) => {
      const tier = event.target.closest("#pet-tiers [data-tier]");
      const row = event.target.closest(".gear-row");
      if (tier) state.tier = tier.dataset.tier || "";
      else if (row) state.sel = row.dataset.id;
      else return;
      for (const button of host.querySelectorAll("#pet-tiers [data-tier]")) {
        button.setAttribute("aria-pressed", button.dataset.tier === state.tier ? "true" : "false");
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
    host.querySelector("#pet-fold").addEventListener("click", () => {
      state.folded = !state.folded;
      applyFold();
    });
  }

  function applyFold() {
    host.classList.toggle("folded", state.folded);
    const button = host.querySelector("#pet-fold");
    const label = state.folded ? "展開清單" : "收合清單";
    button.setAttribute("aria-expanded", String(!state.folded));
    button.setAttribute("aria-label", label);
    button.title = label;
  }

  function mount(parent) {
    if (host?.isConnected && host.parentElement === parent) return;
    parent.innerHTML = shell();
    host = parent.querySelector(".gear-book");
    host.querySelector("#pet-q").value = state.q;
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
    host?.querySelector("#pet-q")?.focus();
  }

  root.XJPet = { mount, unmount, focusSearch };
})(window);
