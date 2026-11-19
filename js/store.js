(function (root) {
  const DB = "xj-memo";
  const VERSION = 1;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("builds")) db.createObjectStore("builds", { keyPath: "id" });
        if (!db.objectStoreNames.contains("images")) db.createObjectStore("images");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  function tx(store, mode) {
    return open().then((db) => db.transaction(store, mode).objectStore(store));
  }

  function request(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function listBuilds() {
    const rows = await request((await tx("builds", "readonly")).getAll());
    rows.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    return rows;
  }

  async function saveBuild(build) {
    build.updated = Date.now();
    await request((await tx("builds", "readwrite")).put(build));
    return build;
  }

  async function deleteBuild(id) {
    const build = await request((await tx("builds", "readonly")).get(id));
    if (build) {
      const ids = imageIds(build);
      const store = await tx("images", "readwrite");
      for (const imageId of ids) store.delete(imageId);
    }
    await request((await tx("builds", "readwrite")).delete(id));
  }

  function imageIds(build) {
    const ids = [];
    for (const page of Object.values(build.pages || {})) {
      if (page && page.imageId) ids.push(page.imageId);
    }
    for (const extra of build.extras || []) {
      if (extra.imageId) ids.push(extra.imageId);
    }
    for (const slot of Object.values(build.gear || {})) {
      if (slot && slot.imageId) ids.push(slot.imageId);
    }
    return ids;
  }

  async function putImage(blob) {
    const id = crypto.randomUUID();
    await request((await tx("images", "readwrite")).put(blob, id));
    return id;
  }

  async function getImage(id) {
    if (!id) return null;
    return request((await tx("images", "readonly")).get(id));
  }

  async function deleteImage(id) {
    if (!id) return;
    await request((await tx("images", "readwrite")).delete(id));
  }

  async function clearAll() {
    const db = await open();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(["builds", "images"], "readwrite");
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("清除失敗"));
      transaction.objectStore("builds").clear();
      transaction.objectStore("images").clear();
    });
  }

  root.XJStore = { open, listBuilds, saveBuild, deleteBuild, putImage, getImage, deleteImage, clearAll, imageIds };
})(typeof window !== "undefined" ? window : globalThis);
