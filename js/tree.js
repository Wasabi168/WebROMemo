(function (root) {
  const data = root.XJTreeData;
  if (!data) return;

  const SVG = "http://www.w3.org/2000/svg";
  const SCALE = data.scale;
  const KIND_RANK = { ultimate: 40, junction: 30, notable: 20, attribute: 0 };
  const ART_SCALE = { attribute: 2.7, notable: 52 / 17, junction: 58 / 14, ultimate: 74 / 21 };
  const routeByKey = Object.fromEntries(data.routes.map((route) => [route.key, route]));
  const colorByStat = Object.fromEntries(data.routes.map((route) => [route.stat, route.color]));

  const byId = new Map(data.nodes.map((node) => [node.id, node]));
  const adj = new Map([["", []]]);
  for (const node of data.nodes) adj.set(node.id, []);
  for (const [a, b] of data.edges) {
    adj.get(a).push(b);
    adj.get(b).push(a);
  }
  const openIds = new Set(adj.get(""));

  for (const node of data.nodes) {
    const route = node.r ? routeByKey[node.r] : null;
    const statName = node.s ? data.stats[node.s] : "";
    node.hay = [node.n, node.d, data.kinds[node.k], route?.name || "", statName, node.f || ""].join("\n").toLowerCase();
  }

  const state = {
    q: "",
    route: "",
    kind: "",
    selected: "",
    pop: "",
    active: 0,
    results: [],
    listed: [],
    cam: { x: 0, y: 0, zoom: 0.55 },
    marks: new Set(),
    missed: [],
    folded: false,
  };

  let host = null;
  let svg = null;
  let resizeObserver = null;
  let onKey = null;
  const nodeEls = new Map();
  const labelEls = new Map();
  const edgeEls = new Map();

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function svgEl(name, attrs) {
    const node = document.createElementNS(SVG, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  }

  function radiusOf(node) {
    if (node.k === "attribute") return node.b ? 12 : 8;
    if (node.k === "ultimate") return 26;
    if (node.k === "notable") return 17;
    return 14;
  }

  function colorOf(node) {
    if (node.s && colorByStat[node.s]) return colorByStat[node.s];
    if (node.r && routeByKey[node.r]) return routeByKey[node.r].color;
    return "#c9b46b";
  }

  function place(node) {
    return { x: node.x * SCALE, y: node.y * SCALE };
  }

  function edgeKey(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  function mount(parent) {
    if (host?.isConnected && host.parentElement === parent) return;
    parent.innerHTML = shell();
    host = parent.querySelector(".atlas");
    svg = host.querySelector(".atlas-svg");
    drawMap();
    bind();
    host.querySelector("#tree-q").value = state.q;
    syncPressed("#tree-routes", "data-route", state.route);
    syncPressed("#tree-kinds", "data-kind", state.kind);
    applyView();
    refresh();
    applyFold();
    if (!state.folded) host.querySelector("#tree-q").focus();
  }

  function unmount() {
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (onKey) document.removeEventListener("keydown", onKey, true);
    onKey = null;
    host = null;
    svg = null;
    nodeEls.clear();
    labelEls.clear();
    edgeEls.clear();
  }

  function focusSearch() {
    host?.querySelector("#tree-q")?.focus();
  }

  function shell() {
    const routes = [`<button type="button" data-route="" aria-pressed="true">全部</button>`]
      .concat(data.routes.map((route) => `<button type="button" data-route="${route.key}" aria-pressed="false"><i class="route-dot" style="background:${route.color}"></i>${esc(route.name)}</button>`))
      .join("");
    const kinds = [["", "全部"], ["ultimate", "終極"], ["notable", "專精"], ["junction", "交會"], ["attribute", "素質"]]
      .map(([id, name]) => `<button type="button" data-kind="${id}" aria-pressed="${id === "" ? "true" : "false"}">${name}</button>`)
      .join("");
    return `<div class="atlas">
      <aside class="atlas-side">
        <div class="atlas-tools">
          <button class="icon-btn atlas-fold" id="tree-fold" type="button" aria-expanded="true" aria-label="收合清單" title="收合清單"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 6 8 12l6 6"/></svg></button>
          <div class="atlas-ocr"><button class="icon-btn primary" id="tree-ocr" type="button" aria-label="貼上天賦清單" title="貼上天賦清單"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="4" width="8" height="4" rx="1"/><path d="M16 6h2a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2"/><path d="M12 11v6M9 14h6"/></svg></button></div>
        </div>
        <label class="atlas-search">搜尋節點<input id="tree-q" type="search" placeholder="名稱或效果，例如 破軍、暴擊、中毒" autocomplete="off"></label>
        <div class="gear-filters">
          <div class="gear-filter" id="tree-routes"><span>路線</span><div class="atlas-filters">${routes}</div></div>
          <div class="gear-filter" id="tree-kinds"><span>種類</span><div class="atlas-filters">${kinds}</div></div>
        </div>
        <div class="atlas-detail" id="tree-detail"></div>
        <p class="atlas-count" id="tree-count"></p>
        <div class="atlas-hits" id="tree-hits"></div>
      </aside>
      <div class="atlas-map">
        <svg class="atlas-svg" role="group" aria-label="全職業共用天賦樹"></svg>
        <div class="atlas-zoom">
          <button type="button" data-zoom="in" aria-label="放大">＋</button>
          <button type="button" data-zoom="out" aria-label="縮小">－</button>
          <button type="button" data-zoom="home" aria-label="回到起點">⌂</button>
        </div>
        <div id="tree-pop" class="tree-pop" hidden></div>
      </div>
    </div>`;
  }

  function drawMap() {
    const edges = svgEl("g", { class: "edges" });
    for (const [a, b] of data.edges) {
      const pa = a ? place(byId.get(a)) : { x: 0, y: 0 };
      const pb = b ? place(byId.get(b)) : { x: 0, y: 0 };
      const line = svgEl("line", { class: "t-edge", x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y });
      edges.append(line);
      edgeEls.set(edgeKey(a, b), line);
    }
    const nodes = svgEl("g", { class: "nodes" });
    const labels = svgEl("g", { class: "t-labels" });
    for (const node of data.nodes) {
      const at = place(node);
      const radius = radiusOf(node);
      const open = openIds.has(node.id) ? "open" : "off";
      const group = svgEl("g", { class: `tn ${open}`, transform: `translate(${at.x} ${at.y})` });
      group.dataset.id = node.id;
      const title = svgEl("title", {});
      title.textContent = `${node.n}　${node.d}`;
      group.append(title);
      const artSize = radius * ART_SCALE[node.k];
      const hit = node.k === "attribute" ? artSize / 2 : radius;
      group.append(svgEl("circle", {
        class: `t-node ${node.k} ${open} art`,
        r: hit,
        style: `--c:${colorOf(node)}`,
      }));
      if (node.art) {
        group.append(svgEl("image", {
          class: `t-art ${node.k} ${open}`,
          href: `assets/ro/${node.art}`,
          x: -artSize / 2,
          y: -artSize / 2,
          width: artSize,
          height: artSize,
        }));
      }
      addIcon(group, node, radius, open);
      group.append(svgEl("circle", { class: "ring hit", r: hit + 7 }));
      group.append(svgEl("circle", { class: "ring sel", r: hit + 11 }));
      nodes.append(group);
      nodeEls.set(node.id, group);
      if (node.k !== "attribute") {
        const label = svgEl("text", { class: "t-label", x: at.x, y: at.y + radius + 16 });
        label.dataset.id = node.id;
        label.textContent = node.n;
        labels.append(label);
        labelEls.set(node.id, label);
      }
    }
    const centerLabel = svgEl("text", { class: "t-label center", x: 0, y: 6 });
    centerLabel.textContent = "冒險者起點";
    labels.append(centerLabel);
    svg.append(
      edges,
      svgEl("circle", { class: "t-halo center", cx: 0, cy: 0, r: 52 }),
      svgEl("circle", { class: "t-center", cx: 0, cy: 0, r: 40 }),
      nodes,
      labels,
    );
  }

  function addIcon(group, node, radius, open) {
    if (!node.ic) return;
    const size = radius * (node.k === "ultimate" ? 1.5 : 1.4);
    const half = size / 2;
    const href = `assets/ro/${node.ic}`;
    const cls = `t-icon ${open}${node.ic.startsWith("skills/") ? " round" : ""}`;
    const image = () => svgEl("image", { class: cls, href, x: -half, y: -half, width: size, height: size });
    if (!node.dual) {
      group.append(image());
      return;
    }
    const shift = size * 0.12;
    const left = svgEl("g", { transform: `translate(${-shift} 0)` });
    left.append(image());
    const right = svgEl("g", { transform: `translate(${shift} 0) scale(-1 1)` });
    right.append(image());
    group.append(left, right);
  }

  function bind() {
    const input = host.querySelector("#tree-q");
    input.addEventListener("input", () => {
      state.q = input.value;
      state.marks = new Set();
      state.missed = [];
      state.active = 0;
      refresh();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveActive(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveActive(-1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const node = state.listed[state.active];
        if (node) {
          choose(node.id, true);
          showPop(node.id);
        }
      } else if (event.key === "Escape" && input.value) {
        event.stopPropagation();
        input.value = "";
        state.q = "";
        state.active = 0;
        refresh();
      }
    });
    host.querySelector("#tree-routes").addEventListener("click", (event) => {
      const button = event.target.closest("[data-route]");
      if (!button) return;
      state.route = button.dataset.route;
      state.marks = new Set();
      state.missed = [];
      state.active = 0;
      syncPressed("#tree-routes", "data-route", state.route);
      refresh();
      const named = state.results.filter((node) => node.k !== "attribute");
      if (!state.q.trim() && state.route && named.length) frame(named);
    });
    host.querySelector("#tree-kinds").addEventListener("click", (event) => {
      const button = event.target.closest("[data-kind]");
      if (!button) return;
      state.kind = button.dataset.kind;
      state.marks = new Set();
      state.missed = [];
      state.active = 0;
      syncPressed("#tree-kinds", "data-kind", state.kind);
      refresh();
    });
    host.querySelector("#tree-hits").addEventListener("click", (event) => {
      const frameButton = event.target.closest("[data-frame]");
      if (frameButton) {
        frame(state.results.filter((node) => node.k === "attribute"));
        return;
      }
      const button = event.target.closest("[data-id]");
      if (!button) return;
      state.active = Number(button.dataset.index) || 0;
      choose(button.dataset.id, true);
      showPop(button.dataset.id);
    });
    host.querySelector(".atlas-zoom").addEventListener("click", (event) => {
      const button = event.target.closest("[data-zoom]");
      if (!button) return;
      if (button.dataset.zoom === "home") {
        state.cam = { x: 0, y: 0, zoom: 0.55 };
        applyView();
        return;
      }
      const next = button.dataset.zoom === "in" ? state.cam.zoom * 1.3 : state.cam.zoom / 1.3;
      state.cam.zoom = clampZoom(next);
      applyView();
    });
    svg.addEventListener("wheel", onWheel, { passive: false });
    let drag = null;
    let moved = false;
    let downId = "";
    svg.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      downId = event.target.closest?.(".tn")?.dataset.id || nodeAt(event.clientX, event.clientY);
      drag = { x: event.clientX, y: event.clientY, cx: state.cam.x, cy: state.cam.y };
      moved = false;
      svg.setPointerCapture(event.pointerId);
    });
    svg.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (dx * dx + dy * dy <= 16) return;
      moved = true;
      svg.classList.add("dragging");
      const scale = worldPerPixel();
      state.cam.x = drag.cx - dx * scale;
      state.cam.y = drag.cy - dy * scale;
      applyView();
    });
    const endDrag = () => {
      drag = null;
      svg.classList.remove("dragging");
    };
    svg.addEventListener("pointerup", (event) => {
      const wasDrag = moved;
      const id = downId || nodeAt(event.clientX, event.clientY);
      downId = "";
      endDrag();
      if (wasDrag) return;
      if (!id) {
        hidePop();
        return;
      }
      choose(id, false);
      showPop(id);
    });
    svg.addEventListener("pointercancel", endDrag);
    host.querySelector("#tree-pop").addEventListener("click", (event) => {
      if (event.target.closest("[data-pop-close]")) hidePop();
    });
    onKey = (event) => {
      if (event.key !== "Escape" || !state.pop) return;
      hidePop();
      event.stopPropagation();
    };
    document.addEventListener("keydown", onKey, true);
    host.querySelector("#tree-fold").addEventListener("click", () => {
      state.folded = !state.folded;
      applyFold();
    });
    host.querySelector("#tree-ocr").addEventListener("click", () => {
      const pending = navigator.clipboard?.read?.();
      pasteTalents(pending).catch((error) => setStatus(error.message || "辨識失敗"));
    });
    resizeObserver = new ResizeObserver(() => applyView());
    resizeObserver.observe(host.querySelector(".atlas-map"));
  }

  function applyFold() {
    host.classList.toggle("folded", state.folded);
    const button = host.querySelector("#tree-fold");
    const label = state.folded ? "展開清單" : "收合清單";
    button.setAttribute("aria-expanded", String(!state.folded));
    button.setAttribute("aria-label", label);
    button.title = label;
  }

  function nodeAt(x, y) {
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      const group = el.closest?.(".tn");
      if (group?.dataset.id) return group.dataset.id;
    }
    return "";
  }

  function syncPressed(selector, attr, value) {
    for (const button of host.querySelectorAll(`${selector} button`)) {
      button.setAttribute("aria-pressed", String(button.getAttribute(attr) === value));
    }
  }

  function onWheel(event) {
    event.preventDefault();
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    if (!delta) return;
    const before = clientToWorld(event.clientX, event.clientY);
    state.cam.zoom = clampZoom(state.cam.zoom * Math.exp(-delta * 0.0011));
    applyView();
    const after = clientToWorld(event.clientX, event.clientY);
    state.cam.x += before.x - after.x;
    state.cam.y += before.y - after.y;
    applyView();
  }

  const fullTree = (() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of data.nodes) {
      const at = place(node);
      const radius = radiusOf(node);
      const art = (radius * (ART_SCALE[node.k] || 1)) / 2;
      const extra = node.k === "attribute" ? art : Math.max(art, radius + 28);
      minX = Math.min(minX, at.x - extra);
      minY = Math.min(minY, at.y - extra);
      maxX = Math.max(maxX, at.x + extra);
      maxY = Math.max(maxY, at.y + extra);
    }
    return { minX, minY, maxX, maxY };
  })();

  function fitZoom() {
    const rect = svg ? svg.getBoundingClientRect() : null;
    const aspect = rect && rect.height > 0 ? rect.width / rect.height : 1400 / 1100;
    const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1400 / 1100;
    const worldH = fullTree.maxY - fullTree.minY + 80;
    const worldW = fullTree.maxX - fullTree.minX + 80;
    const h = Math.max(worldH, worldW / safeAspect);
    return (1100 / (h * 2.2)) * 0.92;
  }

  function clampZoom(zoom) {
    return Math.min(2.5, Math.max(fitZoom(), zoom));
  }

  function viewHeight() {
    return 1100 / state.cam.zoom / 2.2;
  }

  function applyView() {
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const aspect = rect.width / Math.max(1, rect.height);
    const h = viewHeight();
    const w = h * (Number.isFinite(aspect) && aspect > 0 ? aspect : 1400 / 1100);
    svg.setAttribute("viewBox", `${state.cam.x - w / 2} ${state.cam.y - h / 2} ${w} ${h}`);
    placePop();
  }

  function worldPerPixel() {
    const rect = svg.getBoundingClientRect();
    return viewHeight() / Math.max(1, rect.height);
  }

  function clientToWorld(clientX, clientY) {
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: state.cam.x, y: state.cam.y };
    const world = point.matrixTransform(matrix.inverse());
    return { x: world.x, y: world.y };
  }

  function refresh() {
    const tokens = state.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const marking = state.marks.size > 0 && !tokens.length && !state.route && !state.kind;
    const filtering = Boolean(tokens.length || state.route || state.kind || marking);
    state.results = data.nodes.filter((node) => {
      if (marking) return state.marks.has(node.id);
      if (state.route && node.r !== state.route && node.s !== state.route) return false;
      if (state.kind && node.k !== state.kind) return false;
      if (!tokens.length) return Boolean(state.route || state.kind);
      return tokens.every((token) => node.hay.includes(token));
    });
    state.results.sort((a, b) => rank(b, state.q.trim()) - rank(a, state.q.trim()) || a.n.localeCompare(b.n, "zh-Hant"));
    const hits = new Set(state.results.map((node) => node.id));
    svg.classList.toggle("searching", filtering);
    for (const [id, group] of nodeEls) group.classList.toggle("hit", hits.has(id));
    for (const [id, label] of labelEls) label.classList.toggle("hit", hits.has(id));
    if (filtering && state.selected && !hits.has(state.selected)) state.selected = "";
    renderHits(tokens);
    renderDetail();
    if (state.results.length === 1 && tokens.length) {
      choose(state.results[0].id, true);
      showPop(state.results[0].id);
    }
  }

  function rank(node, query) {
    const name = node.n.toLowerCase();
    const q = query.toLowerCase();
    let score = KIND_RANK[node.k] || 0;
    if (!q) return score;
    if (name === q) score += 1000;
    else if (name.startsWith(q)) score += 500;
    else if (name.includes(q)) score += 200;
    else score += 40;
    return score;
  }

  function renderHits(tokens) {
    const box = host.querySelector("#tree-hits");
    const count = host.querySelector("#tree-count");
    const named = state.results.filter((node) => node.k !== "attribute");
    const attrs = state.results.filter((node) => node.k === "attribute");
    const showAttrs = state.kind === "attribute" || !named.length;
    state.listed = showAttrs ? state.results.slice(0, 80) : named.slice(0, 80);
    const listed = state.listed;
    if (!tokens.length && !state.route && !state.kind && !state.marks.size) {
      count.textContent = "706 個節點。輸入文字後，符合的會在星圖上亮起來。";
      box.innerHTML = `<p class="atlas-empty">可以搜名稱，也可以搜效果裡的字，像是「流血」、「召喚物」、「冷卻」。</p>`;
      return;
    }
    const bits = [];
    if (state.marks.size && !tokens.length && !state.route && !state.kind) {
      bits.push(`已標出 ${named.length} 個`);
      if (state.missed.length) bits.push(`沒對上 ${state.missed.join("、")}`);
    }
    if (named.length && !bits.length) bits.push(`${named.length} 個有名字的節點`);
    if (attrs.length) bits.push(`${attrs.length} 個素質節點`);
    count.textContent = bits.length ? bits.join("，") : "沒有符合的節點";
    if (!listed.length) {
      box.innerHTML = `<p class="atlas-empty">沒有符合的節點。換一個詞，或把路線、種類改回全部。</p>`;
      return;
    }
    const rows = listed.map((node, index) => hitRow(node, index)).join("");
    const extra = !showAttrs && attrs.length
      ? `<button type="button" class="hit-row summary" data-frame="attrs"><b>素質節點 × ${attrs.length}</b><span>已經標在星圖上。點這裡把這一批收進畫面。</span></button>`
      : "";
    const more = showAttrs && state.results.length > listed.length
      ? `<p class="atlas-empty">還有 ${state.results.length - listed.length} 個，請再縮小範圍。</p>`
      : "";
    box.innerHTML = rows + extra + more;
    if (state.selected) host.querySelector(`#tree-hits [data-id="${CSS.escape(state.selected)}"]`)?.setAttribute("aria-current", "true");
  }

  function hitRow(node, index) {
    const route = node.r ? routeByKey[node.r] : node.s ? data.routes.find((item) => item.stat === node.s) : null;
    const meta = [data.kinds[node.k], route?.name || "", `${node.c} 點`, node.lv ? `Lv${node.lv}` : ""].filter(Boolean).join(" · ");
    const dot = route ? `<i class="route-dot" style="background:${route.color}"></i>` : "";
    return `<button type="button" class="hit-row" data-id="${esc(node.id)}" data-index="${index}"><b>${dot}${esc(node.n)}</b><small>${esc(meta)}</small><span>${esc(node.d)}</span></button>`;
  }

  function renderDetail() {
    const box = host.querySelector("#tree-detail");
    const node = byId.get(state.selected);
    if (!node) {
      const hint = state.results.length
        ? `有 ${state.results.length} 個結果。點一個，或按 Enter 定位第一個。金色虛線會標出從起點過去的路。`
        : "點星圖上的節點，或點搜尋結果。選中之後會畫出從冒險者起點走過去的路。";
      box.innerHTML = `<p class="hint">${hint}</p>`;
      for (const group of nodeEls.values()) group.classList.remove("sel");
      for (const line of edgeEls.values()) line.classList.remove("path");
      hidePop();
      return;
    }
    const route = node.r ? routeByKey[node.r] : node.s ? data.routes.find((item) => item.stat === node.s) : null;
    const steps = pathTo(node.id);
    const meta = [data.kinds[node.k], route ? route.name : "", `${node.c} 點`, node.lv ? `Lv${node.lv} 開放` : "", node.f || ""].filter(Boolean).join(" · ");
    const resonance = node.k === "ultimate"
      ? node.res && route
        ? `共鳴：每點亮 1 個〔${route.name}〕路線（${data.stats[route.stat]}）的專精天賦，正面效果 +10%（最多 5 個，+50%）。`
        : "這個終極天賦沒有共鳴。"
      : "";
    box.innerHTML = `<h2>${esc(node.n)}</h2><p class="meta">${route ? `<i class="route-dot" style="background:${route.color}"></i>` : ""}${esc(meta)}</p><p>${esc(node.d)}</p>${resonance ? `<p class="hint">${esc(resonance)}</p>` : ""}<p class="hint">從起點沿著連線要經過 ${steps.length} 個節點。</p>`;
    for (const group of nodeEls.values()) group.classList.toggle("sel", group.dataset.id === node.id);
    for (const line of edgeEls.values()) line.classList.remove("path");
    for (const [a, b] of steps) edgeEls.get(edgeKey(a, b))?.classList.add("path");
  }

  function pathTo(id) {
    const prev = new Map([["", null]]);
    const queue = [""];
    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];
      if (current === id) break;
      for (const next of adj.get(current) || []) {
        if (prev.has(next)) continue;
        prev.set(next, current);
        queue.push(next);
      }
    }
    const steps = [];
    let current = id;
    while (current) {
      const parent = prev.get(current);
      if (parent === undefined) break;
      steps.push([parent, current]);
      current = parent;
    }
    return steps;
  }

  function choose(id, zoom) {
    state.selected = id;
    const index = state.listed.findIndex((node) => node.id === id);
    if (index >= 0) state.active = index;
    renderDetail();
    const current = host.querySelector("#tree-hits [aria-current]");
    if (current) current.removeAttribute("aria-current");
    host.querySelector(`#tree-hits [data-id="${CSS.escape(id)}"]`)?.setAttribute("aria-current", "true");
    if (zoom) focusNode(byId.get(id));
  }

  function showPop(id) {
    const node = byId.get(id);
    const pop = host?.querySelector("#tree-pop");
    if (!node || !pop) return;
    const route = node.r ? routeByKey[node.r] : node.s ? data.routes.find((item) => item.stat === node.s) : null;
    const meta = [data.kinds[node.k], route?.name || "", `${node.c} 點`].filter(Boolean).join(" · ");
    const resonance = node.k === "ultimate"
      ? node.res && route
        ? `共鳴：每點亮 1 個〔${route.name}〕專精，正面效果 +10%（最多 5 個）。`
        : "這個終極天賦沒有共鳴。"
      : "";
    state.pop = id;
    pop.hidden = false;
    pop.innerHTML = `<button type="button" class="tree-pop-close" data-pop-close aria-label="關閉">×</button><b>${route ? `<i class="route-dot" style="background:${route.color}"></i>` : ""}${esc(node.n)}</b><small>${esc(meta)}</small><p>${esc(node.d)}</p>${resonance ? `<p class="hint">${esc(resonance)}</p>` : ""}`;
    placePop();
  }

  function hidePop() {
    state.pop = "";
    const pop = host?.querySelector("#tree-pop");
    if (pop) pop.hidden = true;
  }

  function placePop() {
    const pop = host?.querySelector("#tree-pop");
    if (!pop || !state.pop) return;
    const group = nodeEls.get(state.pop);
    const map = host.querySelector(".atlas-map");
    if (!group || !map) return;
    const mapRect = map.getBoundingClientRect();
    const nodeRect = group.getBoundingClientRect();
    const centerX = nodeRect.left + nodeRect.width / 2;
    const centerY = nodeRect.top + nodeRect.height / 2;
    const viewTop = Math.max(mapRect.top, 0);
    const viewBottom = Math.min(mapRect.bottom, window.innerHeight);
    const viewLeft = Math.max(mapRect.left, 0);
    const viewRight = Math.min(mapRect.right, window.innerWidth);
    const outside = centerX < viewLeft || centerX > viewRight || centerY < viewTop || centerY > viewBottom;
    pop.hidden = outside;
    if (outside || viewBottom - viewTop < 48) return;
    const gap = 8;
    pop.style.left = "0px";
    pop.style.top = "0px";
    const width = pop.offsetWidth;
    const height = pop.offsetHeight;
    let left = nodeRect.right - mapRect.left + gap;
    if (left + mapRect.left + width > viewRight - 8) left = nodeRect.left - mapRect.left - width - gap;
    const minLeft = viewLeft - mapRect.left + 8;
    const maxLeft = viewRight - mapRect.left - width - 8;
    left = Math.max(minLeft, Math.min(left, maxLeft));
    const below = nodeRect.bottom - mapRect.top + gap;
    const above = nodeRect.top - mapRect.top - height - gap;
    let top = centerY > (viewTop + viewBottom) / 2 ? above : below;
    const minTop = viewTop - mapRect.top + 8;
    const maxTop = viewBottom - mapRect.top - height - 8;
    top = Math.max(minTop, Math.min(top, Math.max(minTop, maxTop)));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  function moveActive(delta) {
    if (!state.listed.length) return;
    state.active = (state.active + delta + state.listed.length) % state.listed.length;
    const current = host.querySelector("#tree-hits [aria-current]");
    if (current) current.removeAttribute("aria-current");
    const next = host.querySelector(`#tree-hits [data-index="${state.active}"]`);
    if (!next) return;
    next.setAttribute("aria-current", "true");
    next.scrollIntoView({ block: "nearest" });
  }

  function focusNode(node) {
    if (!node) return;
    const at = place(node);
    state.cam.x = at.x;
    state.cam.y = at.y;
    state.cam.zoom = Math.max(state.cam.zoom, 1.05);
    applyView();
  }

  function frame(nodes) {
    if (!nodes.length || !svg) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of nodes) {
      const at = place(node);
      minX = Math.min(minX, at.x);
      minY = Math.min(minY, at.y);
      maxX = Math.max(maxX, at.x);
      maxY = Math.max(maxY, at.y);
    }
    state.cam.x = (minX + maxX) / 2;
    state.cam.y = (minY + maxY) / 2;
    const rect = svg.getBoundingClientRect();
    const aspect = rect.width / Math.max(1, rect.height);
    const pad = 120;
    const worldH = Math.max(80, maxY - minY + pad * 2);
    const worldW = Math.max(80, maxX - minX + pad * 2);
    const h = Math.max(worldH, worldW / aspect);
    state.cam.zoom = clampZoom(1100 / (h * 2.2));
    applyView();
  }

  function setStatus(text) {
    const el = document.querySelector("#status");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("show", Boolean(text));
  }

  function distance(a, b) {
    const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;
    for (let i = 1; i <= a.length; i += 1) {
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      }
    }
    return rows[a.length][b.length];
  }

  function matchTalent(name, pool) {
    const exact = pool.filter((node) => node.n === name);
    if (exact.length) return exact;
    if (name.length < 3) return [];
    let best = null;
    for (const node of pool) {
      if (Math.abs(node.n.length - name.length) > 1) continue;
      if (distance(name, node.n) !== 1) continue;
      const gap = Math.abs(node.n.length - name.length);
      if (!best || gap < best.gap) best = { node, gap };
    }
    return best ? [best.node] : [];
  }

  function applyTalentText(raw) {
    const names = root.XJOcr.parseTalentNames(raw);
    const pool = data.nodes.filter((node) => node.k === "notable" || node.k === "junction" || node.k === "ultimate");
    const ids = new Set();
    const missed = [];
    const found = [];
    for (const name of names) {
      const hits = matchTalent(name, pool);
      if (!hits.length) {
        missed.push(name);
        continue;
      }
      for (const node of hits) {
        ids.add(node.id);
        if (!found.includes(node.n)) found.push(node.n);
      }
    }
    state.q = "";
    state.route = "";
    state.kind = "";
    state.marks = ids;
    state.missed = missed;
    state.selected = "";
    state.active = 0;
    state.pop = "";
    if (host) {
      const input = host.querySelector("#tree-q");
      if (input) input.value = "";
      syncPressed("#tree-routes", "data-route", "");
      syncPressed("#tree-kinds", "data-kind", "");
      refresh();
      const named = state.results.filter((node) => node.k !== "attribute");
      if (named.length) frame(named);
    }
    if (!found.length) setStatus("這張圖沒有對上天賦名稱");
    else setStatus(missed.length ? `已標出 ${found.length} 個，沒對上 ${missed.join("、")}` : `已標出 ${found.length} 個`);
    return { found, missed };
  }

  let talentBusy = false;

  async function readClipboardFile(pending) {
    if (!pending && !navigator.clipboard?.read) {
      setStatus("這個瀏覽器讀不到剪貼簿");
      return null;
    }
    let items = [];
    try {
      items = await (pending || navigator.clipboard.read());
    } catch {
      setStatus("沒有取得剪貼簿，請允許這個頁面讀取");
      return null;
    }
    for (const item of items) {
      const type = item.types.find((entry) => entry.startsWith("image/"));
      if (!type) continue;
      const blob = await item.getType(type);
      return new File([blob], "clipboard.png", { type: blob.type || type });
    }
    setStatus("剪貼簿裡沒有圖片");
    return null;
  }

  async function pasteTalents(pending) {
    if (talentBusy) return;
    const file = await readClipboardFile(pending);
    if (!file) return;
    talentBusy = true;
    setStatus("正在辨識天賦清單…");
    try {
      const text = await root.XJOcr.recognizeText(file, setStatus);
      applyTalentText(text);
    } finally {
      talentBusy = false;
    }
  }

  root.XJTree = { mount, unmount, focusSearch, applyTalentText };
})(window);
