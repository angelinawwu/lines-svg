export interface HSV {
  h: number; // 0..360
  s: number; // 0..1
  v: number; // 0..1
}

export function hexToRgb(hex: string): [number, number, number] | null {
  let s = hex.replace("#", "").trim();
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function rgbToHsv(r: number, g: number, b: number): HSV {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: HSV): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

export function hexToHsv(hex: string): HSV | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsv(...rgb) : null;
}

export function hsvToHex(hsv: HSV): string {
  return rgbToHex(...hsvToRgb(hsv));
}

/** Generate harmony suggestions from a base color. */
export function harmonies(hex: string): string[] {
  const hsv = hexToHsv(hex);
  if (!hsv) return [];
  const rot = (deg: number): string =>
    hsvToHex({ ...hsv, h: (hsv.h + deg + 360) % 360 });
  const out = [
    rot(180), // complementary
    rot(150),
    rot(210), // split complementary
    rot(120),
    rot(-120), // triadic
    hsvToHex({ ...hsv, s: Math.max(0.08, hsv.s * 0.25), v: Math.min(1, hsv.v + 0.5) }), // tint
    hsvToHex({ ...hsv, v: Math.max(0.12, hsv.v * 0.35) }), // shade
  ];
  return [...new Set(out)].filter((c) => c.toLowerCase() !== hex.toLowerCase());
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lum = (hex: string) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    const [r, g, b] = rgb.map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = lum(hexA), b = lum(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export const CURATED_SWATCHES: string[] = [
  "#000000", "#ffffff", "#1722f2", "#ff4d00", "#ffa1e0", "#4f16f0",
  "#0c8a4d", "#f5c518", "#e0245e", "#13c2c2", "#16100b", "#eceae4",
];
