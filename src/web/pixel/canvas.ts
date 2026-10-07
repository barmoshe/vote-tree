// A tiny pixel canvas: an RGBA buffer with the few primitives a pixel-art scene needs.
// Palette: an Israeli election day. Flag blue (#0038b8) and white, the sky-blue (תכלת) of the
// ballot tray, the blue envelope, white slips in black print, cardboard; gold only for a vote.
// The landscape keeps natural greens and Jerusalem stone, cooled so the blues lead.

export const C = {
  ink: "#0b1a3d",
  plum: "#1b2a55",
  dusk: "#3a4a7a",
  mauve: "#a99f88",
  stone: "#cfc6b1",
  mist: "#9fb2c8",
  pale: "#dbe6f0",
  white: "#ffffff",
  wine: "#7a2a2a",
  red: "#c63a32",
  anemone: "#e2453a",
  orange: "#f2a65a",
  amber: "#d1901b",
  gold: "#f6c230",
  goldLight: "#ffe37a",
  goldGlow: "#fff6c2",
  brownDeep: "#2c2232",
  olive: "#4f7a4a",
  oliveLight: "#7aa56a",
  lime: "#c4e2b0",
  pineDeep: "#1f4f46",
  pine: "#2f7a5a",
  green: "#5fae6e",
  leaf: "#a6d68a",
  sageDeep: "#24433f",
  sage: "#3f6f5b",
  sageLight: "#6e9a7c",
  sagePale: "#b9d3c0",
  rust: "#9a5a3c",
  clay: "#9f8259",
  sand: "#c9a878",
  barkDeep: "#2c2232",
  navy: "#14296b",
  indigo: "#2e3f86",
  blue: "#0038b8", // the flag
  royal: "#2e5fd6",
  sky: "#5b9be8",
  skyLight: "#8fd0ea", // the ballot tray
  trayLight: "#c6e8f6",
  trayDeep: "#3d7fc0",
  violet: "#4a4f8f",
  lilac: "#8f8fd6",
  pinkDeep: "#c75b7a",
  pink: "#ee8fa6",
  peach: "#f6c0c8",
  blush: "#ffe9e1",
  teal: "#2a7f8f",
} as const;

type RGBA = number; // packed little-endian 0xAABBGGRR for Uint32Array over ImageData

// Colour lookups run for every pixel, so the cache is a plain object keyed by the hex string.
const cache: Record<string, RGBA> = {};
export function rgba(hex: string): RGBA {
  let v = cache[hex];
  if (v === undefined) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    v = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    cache[hex] = v;
  }
  return v;
}

// 4x4 Bayer thresholds, 0..15.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

export class Pix {
  readonly w: number;
  readonly h: number;
  readonly img: ImageData;
  readonly px: Uint32Array;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.img = new ImageData(w, h);
    this.px = new Uint32Array(this.img.data.buffer);
  }
  set(x: number, y: number, c: string) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = rgba(c);
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    const v = rgba(c);
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.w, Math.round(x + w));
    const y1 = Math.min(this.h, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) this.px.fill(v, yy * this.w + x0, yy * this.w + x1);
  }
  /** A filled disc; `dither` blends to `c2` with the Bayer pattern towards the edge. */
  disc(cx: number, cy: number, r: number, c: string, c2?: string, lightX = -1, lightY = -1) {
    const R = r + 0.5;
    for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++)
      for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > R * R) continue;
        if (c2) {
          // Shade: the side facing away from the light takes the second colour, dithered.
          const t = ((dx * lightX + dy * lightY) / (R || 1)) * 0.5 + 0.5;
          this.set(x, y, t > bayer(x, y) + 0.25 ? c2 : c);
        } else this.set(x, y, c);
      }
  }
  /** A thick line with a round brush. */
  line(x0: number, y0: number, x1: number, y1: number, w: number, c: string) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      if (w <= 1) this.set(x, y, c);
      else this.disc(x, y, (w - 1) / 2, c);
    }
  }
  /** Flat colour bands with short dithered seams between them, the classic pixel sky. */
  sky(y0: number, y1: number, colors: string[], seam = 5) {
    const n = colors.length;
    const step = (y1 - y0) / n;
    for (let y = Math.max(0, Math.round(y0)); y < Math.min(this.h, Math.round(y1)); y++) {
      const f = (y - y0) / step;
      const i = Math.min(n - 1, Math.floor(f));
      const into = (f - i) * step; // pixels into this band
      const toNext = step - into;
      for (let x = 0; x < this.w; x++) {
        let c = colors[i];
        if (i < n - 1 && toNext < seam && 1 - toNext / seam > bayer(x, y)) c = colors[i + 1];
        this.px[y * this.w + x] = rgba(c);
      }
    }
  }
  /** A horizontal band blended from c1 (top) to c2 (bottom) with Bayer dithering. */
  band(y0: number, y1: number, c1: string, c2: string) {
    for (let y = Math.max(0, Math.round(y0)); y < Math.min(this.h, Math.round(y1)); y++) {
      const t = (y - y0) / Math.max(1, y1 - y0);
      for (let x = 0; x < this.w; x++) this.px[y * this.w + x] = rgba(t > bayer(x, y) ? c2 : c1);
    }
  }
  /** Fill below a ridge line given per column. */
  ridge(top: (x: number) => number, c: string, c2?: string, shade = 6) {
    for (let x = 0; x < this.w; x++) {
      const t0 = Math.round(top(x));
      for (let y = Math.max(0, t0); y < this.h; y++) {
        const d = y - t0;
        this.px[y * this.w + x] = rgba(c2 && d < shade && d / shade < bayer(x, y) ? c2 : c);
      }
    }
  }
  /** Draw a sprite: rows of characters mapped through a colour key ('.' = transparent). */
  sprite(x: number, y: number, rows: string[], key: Record<string, string>, flip = false) {
    for (let j = 0; j < rows.length; j++)
      for (let i = 0; i < rows[j].length; i++) {
        const ch = rows[j][flip ? rows[j].length - 1 - i : i];
        const col = key[ch];
        if (col) this.set(x + i, y + j, col);
      }
  }
}
