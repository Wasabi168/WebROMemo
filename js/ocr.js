(function (root) {
  const SCRIPT = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  let workerPromise = null;

  function squeezeCjk(text) {
    let next = text;
    for (let i = 0; i < 4; i += 1) {
      const folded = next.replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff()])/g, "$1");
      if (folded === next) break;
      next = folded;
    }
    return next;
  }

  function polishLine(line) {
    return squeezeCjk(String(line || "")
      .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
      .replace(/[．。]/g, ".")
      .replace(/：/g, ":")
      .replace(/[（]/g, "(")
      .replace(/[）]/g, ")")
      .replace(/[·•・‧]/g, " "))
      .replace(/\(\s+/g, "(")
      .replace(/\s+\)/g, ")")
      .replace(/Lv\.?\s*(\d{1,2})\s*了/gi, (_, digits) => `Lv ${digits}7`)
      .replace(/(\d)[.,]\s*[.,]?(\d)/g, "$1.$2")
      .trim();
  }

  function levenshtein(a, b) {
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

  function matchJob(token, jobs) {
    if (!token) return "";
    const ordered = [...jobs].sort((a, b) => b.length - a.length);
    const exact = ordered.find((job) => token === job || token.includes(job));
    if (exact) return exact;
    let best = null;
    for (const job of ordered) {
      const limit = job.length >= 5 ? 2 : job.length >= 4 ? 1 : 0;
      if (!limit) continue;
      const dist = levenshtein(token, job);
      if (dist > limit) continue;
      if (!best || dist < best.dist || (dist === best.dist && job.length > best.job.length)) best = { job, dist };
    }
    return best ? best.job : "";
  }

  function cleanName(value) {
    let name = String(value || "").replace(/[^\u4e00-\u9fffA-Za-z0-9 _-]/g, " ");
    name = squeezeCjk(name).replace(/\s+/g, " ").trim();
    if (/^[\u4e00-\u9fff\s]+$/.test(name)) name = name.replace(/\s+/g, "");
    if (!name || /層|武鬥|武斗|傷害|實際|截至|DPS|Lv/i.test(name)) return "";
    return name.slice(0, 16);
  }

  function parseRank(raw, jobs) {
    const lines = String(raw || "")
      .split(/\n/)
      .map(polishLine)
      .filter(Boolean);
    const useful = [];
    for (const line of lines) {
      if (/截至|有效傷害|秒計|層間/.test(line)) break;
      useful.push(line);
    }
    const body = useful.join("\n");
    const styleMatch = body.match(/\(([\u4e00-\u9fff]{1,8}流)\)/) || body.match(/([\u4e00-\u9fff]{1,6}流)/);
    const style = styleMatch ? styleMatch[1] : "";
    const before = styleMatch ? body.slice(0, styleMatch.index) : body;
    const tokenMatch = before.match(/([\u4e00-\u9fff]{2,8})\s*$/);
    const token = tokenMatch ? tokenMatch[1] : "";
    const job = matchJob(token, jobs || []);
    let player = "";
    const jobLine = useful.findIndex((line) => (token && line.includes(token)) || (style && line.includes(`(${style})`)));
    if (jobLine > 0) player = cleanName(useful[jobLine - 1]);
    else if (token) {
      const idx = before.lastIndexOf(token);
      if (idx > 0) player = cleanName(before.slice(Math.max(0, idx - 24), idx));
    }
    if (!player) {
      const first = useful.find((line) => !/流|Lv|DPS|層|武鬥|武斗/i.test(line));
      if (first) player = cleanName(first);
    }
    const flat = body.replace(/\n/g, " ");
    const levelMatch = flat.match(/Lv\.?\s*(\d{1,3})/i);
    const floorMatch = flat.match(/第\s*(\d{1,4})\s*層/) || flat.match(/武[鬥斗]場\s*第?\s*(\d{1,4})\s*層/);
    const timeMatch = flat.match(/\(\s*(\d{1,2})\s*:\s*(\d{2})\s*\)/) || flat.match(/層\s*\(?\s*(\d{1,2})\s*:\s*(\d{2})/);
    const dpsMatch = flat.match(/DPS+\s*(\d+(?:\.\d+)?)\s*([KMGTB])?/i)
      || flat.match(/實際[\sA-Za-z]*(\d+(?:\.\d+)?)\s*([KMGTB])/i);
    return {
      player,
      job,
      style,
      level: levelMatch ? levelMatch[1] : "",
      floor: floorMatch ? floorMatch[1] : "",
      time: timeMatch ? `${Number(timeMatch[1])}:${timeMatch[2].padStart(2, "0")}` : "",
      dps: dpsMatch ? `${dpsMatch[1]}${(dpsMatch[2] || "").toUpperCase()}` : "",
    };
  }

  function luminance(data, index) {
    return 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
  }

  function findBands(image) {
    const { width, height, data } = image;
    const rows = [];
    for (let y = 0; y < height; y += 1) {
      let count = 0;
      for (let x = 0; x < width; x += 1) {
        if (luminance(data, (y * width + x) * 4) >= 72) count += 1;
      }
      rows.push(count);
    }
    const spans = [];
    let start = null;
    for (let y = 0; y <= height; y += 1) {
      const on = y < height && rows[y] > 2;
      if (on && start === null) start = y;
      if (!on && start !== null) {
        if (y - start >= 3) spans.push([start, y]);
        start = null;
      }
    }
    const merged = [];
    for (const span of spans) {
      const prev = merged[merged.length - 1];
      if (prev && span[0] - prev[1] <= 4) prev[1] = span[1];
      else merged.push(span);
    }
    return merged.map(([y0, y1]) => {
      let x0 = width;
      let x1 = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (luminance(data, (y * width + x) * 4) < 72) continue;
          if (x < x0) x0 = x;
          if (x + 1 > x1) x1 = x + 1;
        }
      }
      return {
        x0: Math.max(0, x0 - 2),
        x1: Math.min(width, x1 + 2),
        y0: Math.max(0, y0 - 1),
        y1: Math.min(height, y1 + 1),
      };
    }).filter((band) => band.x1 - band.x0 >= 8 && band.y1 - band.y0 >= 4);
  }

  function processLine(image) {
    const { width, height, data } = image;
    const gray = new Float32Array(width * height);
    let sum = 0;
    for (let p = 0, i = 0; p < gray.length; p += 1, i += 4) {
      const y = luminance(data, i);
      gray[p] = y;
      sum += y;
    }
    const invert = sum / gray.length < 140;
    for (let p = 0; p < gray.length; p += 1) gray[p] = invert ? 255 - gray[p] : gray[p];
    const hist = new Uint32Array(256);
    for (let p = 0; p < gray.length; p += 1) hist[Math.max(0, Math.min(255, gray[p] | 0))] += 1;
    const cut = gray.length * 0.01;
    let low = 0;
    let high = 255;
    let seen = 0;
    for (let i = 0; i < 256; i += 1) {
      seen += hist[i];
      if (seen > cut) {
        low = i;
        break;
      }
    }
    seen = 0;
    for (let i = 255; i >= 0; i -= 1) {
      seen += hist[i];
      if (seen > cut) {
        high = i;
        break;
      }
    }
    const span = Math.max(1, high - low);
    const tone = new Uint8ClampedArray(gray.length);
    for (let p = 0; p < gray.length; p += 1) {
      let v = ((gray[p] - low) * 255) / span;
      v = (v - 128) * 1.5 + 128;
      if (v < 0) v = 0;
      if (v > 255) v = 255;
      tone[p] = v;
    }
    const sharp = new Uint8ClampedArray(tone);
    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        let acc = 0;
        let k = 0;
        for (let ky = -1; ky <= 1; ky += 1) {
          for (let kx = -1; kx <= 1; kx += 1) {
            acc += tone[(y + ky) * width + (x + kx)] * kernel[k];
            k += 1;
          }
        }
        if (acc < 0) acc = 0;
        if (acc > 255) acc = 255;
        if (acc > 225) acc = 255;
        sharp[y * width + x] = acc;
      }
    }
    for (let p = 0, i = 0; p < sharp.length; p += 1, i += 4) {
      data[i] = data[i + 1] = data[i + 2] = sharp[p];
      data[i + 3] = 255;
    }
  }

  function renderLine(img, band) {
    const sw = Math.max(1, band.x1 - band.x0);
    const sh = Math.max(1, band.y1 - band.y0);
    const dh = 160;
    const dw = Math.max(1, Math.round(sw * (dh / sh)));
    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, band.x0, band.y0, sw, sh, 0, 0, dw, dh);
    const image = ctx.getImageData(0, 0, dw, dh);
    processLine(image);
    ctx.putImageData(image, 0, 0);
    const pad = 20;
    const padded = document.createElement("canvas");
    padded.width = dw + pad * 2;
    padded.height = dh + pad * 2;
    const pctx = padded.getContext("2d");
    pctx.fillStyle = "#ffffff";
    pctx.fillRect(0, 0, padded.width, padded.height);
    pctx.drawImage(canvas, pad, pad);
    return padded;
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
        reject(new Error("這張圖讀不起來"));
      };
      img.src = url;
    });
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (root.Tesseract) {
        resolve();
        return;
      }
      const el = document.createElement("script");
      el.src = src;
      el.onload = () => resolve();
      el.onerror = () => reject(new Error("辨識元件載不了，請確認可以連上網路"));
      document.head.appendChild(el);
    });
  }

  function getWorker(onStatus) {
    if (!workerPromise) {
      workerPromise = (async () => {
        await loadScript(SCRIPT);
        if (!root.Tesseract) throw new Error("辨識元件載不了，請確認可以連上網路");
        onStatus("正在準備辨識，第一次會下載中文語料…");
        return root.Tesseract.createWorker("chi_tra+eng", 1, {
          logger: (message) => {
            if (message.status === "loading language traineddata") {
              onStatus(`正在下載辨識語料 ${Math.round((message.progress || 0) * 100)}%`);
            }
          },
        });
      })().catch((error) => {
        workerPromise = null;
        throw error;
      });
    }
    return workerPromise;
  }

  async function recognizeText(file, onStatus) {
    const report = onStatus || (() => {});
    const img = await loadImage(file);
    const probe = document.createElement("canvas");
    probe.width = img.width;
    probe.height = img.height;
    const pctx = probe.getContext("2d", { willReadFrequently: true });
    pctx.drawImage(img, 0, 0);
    const bands = findBands(pctx.getImageData(0, 0, img.width, img.height));
    const lines = (bands.length ? bands : [{ x0: 0, y0: 0, x1: img.width, y1: img.height }]).map((band) => renderLine(img, band));
    const worker = await getWorker(report);
    await worker.setParameters({ tessedit_pageseg_mode: "13" });
    const texts = [];
    for (let i = 0; i < lines.length; i += 1) {
      report(`正在辨識 ${i + 1}/${lines.length}`);
      const result = await worker.recognize(lines[i]);
      const text = (result.data.text || "").trim();
      if (text) texts.push(text);
    }
    return texts.join("\n");
  }

  function polishTalentLine(line) {
    return squeezeCjk(String(line || "")
      .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
      .replace(/[：:]/g, "：")
      .replace(/[，,]/g, "、")
      .replace(/[·•‧･．.]/g, "・"))
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseTalentNames(raw) {
    const lines = String(raw || "").split(/\n/).map(polishTalentLine).filter(Boolean);
    const joined = [];
    for (const line of lines) {
      const prev = joined[joined.length - 1];
      if (prev && !/[、：]$/.test(prev) && !/^(專精|交會|終極|天賦)/.test(line)) joined[joined.length - 1] = prev + line;
      else joined.push(line);
    }
    const text = joined.join("\n").replace(/天[上卜]?賦樹/g, "").replace(/點亮\s*\d+\s*個\s*節點/g, "");
    const skip = new Set(["點亮", "節點", "個節點", "終極天賦", "專精", "交會", "沒有", "天賦", "終極"]);
    const names = [];
    for (const part of text.split(/[\n、]/)) {
      const name = part.replace(/.*：/, "").replace(/[^\u4e00-\u9fff・]/g, "");
      if (!name || skip.has(name) || name.length > 10 || names.includes(name)) continue;
      names.push(name);
    }
    return names;
  }

  async function recognizeRank(file, jobs, onStatus) {
    return parseRank(await recognizeText(file, onStatus), jobs);
  }

  root.XJOcr = { parseRank, recognizeRank, recognizeText, parseTalentNames };
})(typeof window === "undefined" ? globalThis : window);
