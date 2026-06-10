// Core line-rendering engine: rasterizes an SVG/image source into a density
// map, then converts it into variable-weight line geometry as SVG paths.

export interface DensityMap {
  w: number;
  h: number;
  data: Float32Array; // 0..1 darkness per pixel
  alpha: Float32Array; // 0..1 raw alpha, independent of sourceMode
}

export type LineStyle = "smooth" | "sharp" | "bars";
export type StepStyle = "sharp" | "round";
export type SourceMode = "luminance" | "alpha";

export interface RenderParams {
  width: number;
  height: number;
  margin: number;
  spacing: number;
  angle: number; // degrees
  minWeight: number; // px
  maxWeight: number; // px
  contrast: number; // 0.2 .. 4
  brightness: number; // -1 .. 1
  invert: boolean;
  smoothing: number; // px window along line
  lineStyle: LineStyle;
  dashLength: number;
  dashGap: number;
  waveAmplitude: number; // px
  waveFrequency: number; // cycles across width
  wavePhase: number; // per-line phase shift, cycles
  lineColor: string;
  bgColor: string;
  transparentBg: boolean;
  blur: number; // px, applied at rasterization
  sourceMode: SourceMode;
  clipToShape: boolean; // clip lines to the source alpha silhouette
  alphaFalloff: number; // 0..1, feathers line weight at alpha edges (alpha mode only)
  stepCount: number; // 0 = continuous, 2..N = quantize weight into N steps
  stepStyle: StepStyle; // how step transitions look: sharp corners or round caps
  skewX: number; // degrees
  skewY: number; // degrees
}

export const DEFAULT_PARAMS: RenderParams = {
  width: 1000,
  height: 1000,
  margin: 120,
  spacing: 26,
  angle: 0,
  minWeight: 3,
  maxWeight: 20,
  contrast: 1.6,
  brightness: 0,
  invert: false,
  smoothing: 14,
  lineStyle: "smooth",
  dashLength: 18,
  dashGap: 10,
  waveAmplitude: 0,
  waveFrequency: 2,
  wavePhase: 0.12,
  lineColor: "#111111",
  bgColor: "#ffffff",
  transparentBg: false,
  blur: 10,
  sourceMode: "luminance",
  clipToShape: false,
  alphaFalloff: 0,
  stepCount: 0,
  stepStyle: "sharp",
  skewX: 0,
  skewY: 0,
};

/** Rasterize an SVG string or image data-url into a density map sized to the art area. */
export async function rasterizeSource(
  source: string,
  isSvg: boolean,
  artW: number,
  artH: number,
  blur: number,
  sourceMode: SourceMode
): Promise<DensityMap> {
  const MAX = 700;
  const scale = Math.min(1, MAX / Math.max(artW, artH));
  const w = Math.max(2, Math.round(artW * scale));
  const h = Math.max(2, Math.round(artH * scale));

  const url = isSvg
    ? URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }))
    : source;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not load source image"));
    el.src = url;
  });
  if (isSvg) URL.revokeObjectURL(url);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  const fit = Math.min(w / iw, h / ih);
  const dw = iw * fit;
  const dh = ih * fit;
  if (blur > 0) ctx.filter = `blur(${blur * scale}px)`;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);

  const { data } = ctx.getImageData(0, 0, w, h);
  const out = new Float32Array(w * h);
  const alphaOut = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3] / 255;
    alphaOut[i] = a;
    if (sourceMode === "alpha") {
      out[i] = a;
    } else {
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      out[i] = a * (1 - lum);
    }
  }
  return { w, h, data: out, alpha: alphaOut };
}

function sampleAlpha(map: DensityMap, x: number, y: number): number {
  const fx = x * (map.w - 1);
  const fy = y * (map.h - 1);
  if (fx < 0 || fy < 0 || fx > map.w - 1 || fy > map.h - 1) return 0;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, map.w - 1);
  const y1 = Math.min(y0 + 1, map.h - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const a = map.alpha[y0 * map.w + x0];
  const b = map.alpha[y0 * map.w + x1];
  const c = map.alpha[y1 * map.w + x0];
  const d = map.alpha[y1 * map.w + x1];
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

function sampleDensity(map: DensityMap, x: number, y: number): number {
  // x,y in 0..1 normalized art coords; bilinear
  const fx = x * (map.w - 1);
  const fy = y * (map.h - 1);
  if (fx < 0 || fy < 0 || fx > map.w - 1 || fy > map.h - 1) return 0;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, map.w - 1);
  const y1 = Math.min(y0 + 1, map.h - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const a = map.data[y0 * map.w + x0];
  const b = map.data[y0 * map.w + x1];
  const c = map.data[y1 * map.w + x0];
  const d = map.data[y1 * map.w + x1];
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

function applyTone(v: number, p: RenderParams): number {
  let out = v + p.brightness;
  out = (out - 0.5) * p.contrast + 0.5;
  out = Math.min(1, Math.max(0, out));
  if (p.invert) out = 1 - out;
  return out;
}

interface Pt {
  x: number;
  y: number;
}

function smoothClosedPath(pts: Pt[]): string {
  const n = pts.length;
  if (n < 3) return "";
  let d = "";
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2;
    if (i === 0) {
      const prev = pts[n - 1];
      d = `M${((prev.x + p.x) / 2).toFixed(2)},${((prev.y + p.y) / 2).toFixed(2)}`;
    }
    d += `Q${p.x.toFixed(2)},${p.y.toFixed(2)} ${mx.toFixed(2)},${my.toFixed(2)}`;
  }
  return d + "Z";
}

function sharpClosedPath(pts: Pt[]): string {
  if (pts.length < 3) return "";
  return (
    "M" +
    pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join("L") +
    "Z"
  );
}

/** Generate SVG path "d" strings for the line art. */
export function generatePaths(map: DensityMap, p: RenderParams): string[] {
  const paths: string[] = [];
  const artW = p.width - p.margin * 2;
  const artH = p.height - p.margin * 2;
  if (artW <= 4 || artH <= 4 || p.spacing < 2) return paths;

  const rad = (p.angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const nx = -dy;
  const ny = dx;
  const cx = p.width / 2;
  const cy = p.height / 2;

  // Project art-rect corners to find offset/t ranges
  const corners = [
    { x: p.margin, y: p.margin },
    { x: p.width - p.margin, y: p.margin },
    { x: p.margin, y: p.height - p.margin },
    { x: p.width - p.margin, y: p.height - p.margin },
  ];
  let oMin = Infinity, oMax = -Infinity, tMin = Infinity, tMax = -Infinity;
  for (const c of corners) {
    const rx = c.x - cx;
    const ry = c.y - cy;
    const o = rx * nx + ry * ny;
    const t = rx * dx + ry * dy;
    oMin = Math.min(oMin, o);
    oMax = Math.max(oMax, o);
    tMin = Math.min(tMin, t);
    tMax = Math.max(tMax, t);
  }

  const step = Math.max(1.5, p.spacing / 8);
  const span = oMax - oMin;
  const count = Math.floor(span / p.spacing);
  const oStart = oMin + (span - count * p.spacing) / 2;
  const smoothWin = Math.max(0, Math.round(p.smoothing / step));

  const toArt = (x: number, y: number) => ({
    u: (x - p.margin) / artW,
    v: (y - p.margin) / artH,
  });

  for (let li = 0; li <= count; li++) {
    const o = oStart + li * p.spacing;
    const phase = li * p.wavePhase * Math.PI * 2;

    // Sample densities along the line
    const N = Math.ceil((tMax - tMin) / step) + 1;
    const vals = new Float32Array(N);
    const cxs = new Float32Array(N);
    const cys = new Float32Array(N);
    const alphaVals = (p.clipToShape || (p.alphaFalloff > 0 && p.sourceMode === "alpha")) ? new Float32Array(N) : null;
    for (let i = 0; i < N; i++) {
      const t = tMin + i * step;
      const waveO =
        o +
        p.waveAmplitude *
          Math.sin(((t - tMin) / (tMax - tMin)) * p.waveFrequency * Math.PI * 2 + phase);
      const x = cx + dx * t + nx * waveO;
      const y = cy + dy * t + ny * waveO;
      cxs[i] = x;
      cys[i] = y;
      const { u, v } = toArt(x, y);
      vals[i] = applyTone(sampleDensity(map, u, v), p);
      if (alphaVals) alphaVals[i] = sampleAlpha(map, u, v);
    }

    // Moving-average smoothing
    let sm = vals;
    if (smoothWin > 0) {
      sm = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        let sum = 0, cnt = 0;
        for (let k = -smoothWin; k <= smoothWin; k++) {
          const j = i + k;
          if (j >= 0 && j < N) {
            sum += vals[j];
            cnt++;
          }
        }
        sm[i] = sum / cnt;
      }
    }

    // Smooth alpha mask (if clipToShape)
    let alphaSm: Float32Array | null = alphaVals;
    if (alphaVals && smoothWin > 0) {
      alphaSm = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        let sum = 0, cnt = 0;
        for (let k = -smoothWin; k <= smoothWin; k++) {
          const j = i + k;
          if (j >= 0 && j < N) { sum += alphaVals[j]; cnt++; }
        }
        alphaSm[i] = sum / cnt;
      }
    }

    // Weight helper: applies alpha taper when clipToShape or alphaFalloff
    const calcW = (i: number): number => {
      const w = p.minWeight + (p.maxWeight - p.minWeight) * sm[i];
      if (p.clipToShape && alphaSm) return w * alphaSm[i];
      if (p.alphaFalloff > 0 && p.sourceMode === "alpha" && alphaSm) {
        const a = alphaSm[i];
        const tapered = Math.pow(Math.min(1, a / Math.max(0.001, p.alphaFalloff)), 1.5);
        return w * tapered;
      }
      return w;
    };

    if (p.lineStyle === "bars") {
      const seg = Math.max(2, p.dashLength + p.dashGap);
      for (let t0 = 0; t0 + p.dashLength <= tMax - tMin + seg; t0 += seg) {
        const i0 = Math.floor(t0 / step);
        const i1 = Math.min(N - 1, Math.ceil((t0 + p.dashLength) / step));
        if (i0 >= N) break;
        let avg = 0, alphaAccum = 0;
        const cnt = i1 - i0 + 1;
        for (let i = i0; i <= i1; i++) {
          avg += sm[Math.min(i, N - 1)];
          if (alphaSm) alphaAccum += alphaSm[Math.min(i, N - 1)];
        }
        avg /= cnt;
        const avgAlpha = alphaSm ? alphaAccum / cnt : 1;
        const w = (p.minWeight + (p.maxWeight - p.minWeight) * avg) * avgAlpha;
        if (w < 0.15) continue;
        const hw = w / 2;
        const a0 = Math.min(i0, N - 1);
        const a1 = i1;
        const x0 = cxs[a0], y0 = cys[a0];
        const x1 = cxs[a1], y1 = cys[a1];
        paths.push(
          sharpClosedPath([
            { x: x0 + nx * hw, y: y0 + ny * hw },
            { x: x1 + nx * hw, y: y1 + ny * hw },
            { x: x1 - nx * hw, y: y1 - ny * hw },
            { x: x0 - nx * hw, y: y0 - ny * hw },
          ])
        );
      }
      continue;
    }

    // Stepped mode: quantize weights into discrete levels, emit per-run constant-width paths
    if (p.stepCount >= 2) {
      const n = p.stepCount;
      // Build quantized weight array
      const qw = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const w = calcW(i);
        if (w < 0.12) { qw[i] = 0; continue; }
        const bucket = Math.round((w - p.minWeight) / (p.maxWeight - p.minWeight) * (n - 1));
        const clamped = Math.max(0, Math.min(n - 1, bucket));
        qw[i] = p.minWeight + (clamped / (n - 1)) * (p.maxWeight - p.minWeight);
      }
      // Collect run boundaries; extend each run one sample into its neighbor so they overlap
      // and antialiasing between adjacent filled paths leaves no visible seam.
      interface StepRun { x0: number; y0: number; x1: number; y1: number; hw: number }
      const runs: StepRun[] = [];
      let ri = 0;
      while (ri < N) {
        const level = qw[ri];
        if (level < 0.12) { ri++; continue; }
        let rj = ri;
        while (rj + 1 < N && qw[rj + 1] === level) rj++;
        // Extend into neighbor by one full sample so runs overlap and antialiasing seams vanish
        const prevEnd = ri > 0 ? ri - 1 : ri;
        const nextStart = rj < N - 1 ? rj + 1 : rj;
        const sx = cxs[prevEnd];
        const sy = cys[prevEnd];
        const ex = cxs[nextStart];
        const ey = cys[nextStart];
        runs.push({ x0: sx, y0: sy, x1: ex, y1: ey, hw: Math.max(0.05, level / 2) });
        ri = rj + 1;
      }
      for (const run of runs) {
        const { x0, y0, x1, y1, hw } = run;
        if (p.stepStyle === "round") {
          const r = hw.toFixed(2);
          paths.push(
            // top-left → top-right (along +normal side)
            `M${(x0 + nx * hw).toFixed(2)},${(y0 + ny * hw).toFixed(2)}` +
            `L${(x1 + nx * hw).toFixed(2)},${(y1 + ny * hw).toFixed(2)}` +
            // right end cap: arc from top-right → bottom-right, bulging outward (sweep=0)
            `A${r},${r} 0 0 0 ${(x1 - nx * hw).toFixed(2)},${(y1 - ny * hw).toFixed(2)}` +
            // bottom-right → bottom-left (along -normal side)
            `L${(x0 - nx * hw).toFixed(2)},${(y0 - ny * hw).toFixed(2)}` +
            // left end cap: arc from bottom-left → top-left, bulging outward (sweep=0)
            `A${r},${r} 0 0 0 ${(x0 + nx * hw).toFixed(2)},${(y0 + ny * hw).toFixed(2)}Z`
          );
        } else {
          paths.push(
            sharpClosedPath([
              { x: x0 + nx * hw, y: y0 + ny * hw },
              { x: x1 + nx * hw, y: y1 + ny * hw },
              { x: x1 - nx * hw, y: y1 - ny * hw },
              { x: x0 - nx * hw, y: y0 - ny * hw },
            ])
          );
        }
      }
      continue;
    }

    // Ribbon: split into segments where width > epsilon
    const EPS = 0.12;
    let segStart = -1;
    const flush = (a: number, b: number) => {
      if (b - a < 1) return;
      const top: Pt[] = [];
      const bot: Pt[] = [];
      for (let i = a; i <= b; i++) {
        const w = calcW(i);
        const hw = Math.max(0.05, w / 2);
        top.push({ x: cxs[i] + nx * hw, y: cys[i] + ny * hw });
        bot.push({ x: cxs[i] - nx * hw, y: cys[i] - ny * hw });
      }
      const ring = top.concat(bot.reverse());
      paths.push(p.lineStyle === "smooth" ? smoothClosedPath(ring) : sharpClosedPath(ring));
    };
    for (let i = 0; i < N; i++) {
      const w = calcW(i);
      if (w >= EPS) {
        if (segStart < 0) segStart = i;
      } else if (segStart >= 0) {
        flush(segStart, i - 1);
        segStart = -1;
      }
    }
    if (segStart >= 0) flush(segStart, N - 1);
  }

  return paths;
}

/** Build a complete standalone SVG document string. */
export function buildSvg(paths: string[], p: RenderParams): string {
  const bg = p.transparentBg
    ? ""
    : `<rect width="${p.width}" height="${p.height}" fill="${p.bgColor}"/>`;
  const body = paths.map((d) => `<path d="${d}"/>`).join("");
  const cx = p.width / 2;
  const cy = p.height / 2;
  const skewTransform =
    p.skewX !== 0 || p.skewY !== 0
      ? ` transform="translate(${cx},${cy}) skewX(${p.skewX}) skewY(${p.skewY}) translate(-${cx},-${cy})"`
      : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${p.width} ${p.height}" width="${p.width}" height="${p.height}">` +
    bg +
    `<g fill="${p.lineColor}"${skewTransform}>${body}</g>` +
    `</svg>`
  );
}
