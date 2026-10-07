import { stratify, tree as d3tree, type HierarchyNode } from "d3-hierarchy";
import type { TreeNode } from "../../shared/api";
import { C, Pix, bayer } from "./canvas";

// Paints the election-day scene into a pixel buffer, and returns the anchors the animation layer
// needs (gold clusters to sparkle, the slot, the flag, the names).
//
// Tree rules: the real invite tree as a half crown; branch thickness by da Vinci's rule
// (∝ √(1 + people above it)); every person is a leaf cluster in the species' colours, and the
// whole cluster turns gold when they vote.

export type ArtNode = TreeNode & { ghost?: boolean };

export type Anchors = {
  gold: [number, number][];
  ghosts: [number, number, number][];
  names: { x: number; y: number; text: string; me?: boolean; gold?: boolean }[];
  slot: [number, number];
  box: { x: number; y: number; w: number; h: number };
  flag: [number, number] | null;
  clouds: [number, number][];
  mood: Mood;
};

type Mood = "night" | "golden" | "day";
type Shades = { shadow: string; deep: string; mid: string; light: string; hi: string; fruit?: string };

export const SPECIES_PIX: Record<string, Shades> = {
  // the default: the sky-blue of the ballot tray, so a growing tree reads as election day
  olive: { shadow: "#2b5f9a", deep: C.trayDeep, mid: C.skyLight, light: C.trayLight, hi: C.white },
  fig: { shadow: "#173f37", deep: C.pineDeep, mid: C.pine, light: C.green, hi: C.leaf },
  almond: { shadow: "#9c3f5c", deep: C.pinkDeep, mid: C.pink, light: C.peach, hi: C.blush },
  oak: { shadow: "#1f3f2a", deep: C.sageDeep, mid: C.olive, light: C.oliveLight, hi: C.lime },
  pomegranate: { shadow: "#173f37", deep: C.pineDeep, mid: C.pine, light: C.green, hi: C.leaf, fruit: C.anemone },
  cedar: { shadow: "#13342f", deep: C.pineDeep, mid: C.teal, light: C.pine, hi: C.green },
};
export const GOLD: Shades = { shadow: C.amber, deep: C.amber, mid: C.gold, light: C.goldLight, hi: C.goldGlow };
const BARK = { deep: C.barkDeep, mid: "#4b3c4a", light: "#76616c" };

// Sky moods: five bands each, top to horizon. Day is flag-blue to white.
const SKIES: [number, Mood, string[]][] = [
  [0, "night", [C.ink, C.ink, C.navy, C.navy, C.indigo]],
  [5.4, "golden", [C.navy, C.indigo, C.violet, C.lilac, C.peach]],
  [6.4, "golden", [C.indigo, C.violet, C.lilac, C.orange, C.goldLight]],
  [7.6, "day", [C.royal, C.sky, C.skyLight, C.trayLight, C.white]],
  [16.8, "day", [C.royal, C.sky, C.skyLight, C.trayLight, C.blush]],
  [18, "golden", [C.indigo, C.violet, C.pinkDeep, C.orange, C.goldLight]],
  [19.2, "golden", [C.navy, C.indigo, C.violet, C.pinkDeep, C.orange]],
  [20.3, "night", [C.ink, C.ink, C.navy, C.navy, C.indigo]],
];
function skyAt(h: number) {
  let s = SKIES[0];
  for (const k of SKIES) if (h >= k[0]) s = k;
  return s;
}

const LAND: Record<Mood, { ridge: string; ridge2: string; hills: string; terrace: string; grove: string; meadow: string; meadow2: string; front: string; front2: string; knesset: string; knessetDark: string }> = {
  day: { ridge: C.mist, ridge2: C.pale, hills: C.stone, terrace: C.mauve, grove: C.sageDeep, meadow: C.sage, meadow2: C.sageLight, front: C.olive, front2: C.oliveLight, knesset: C.white, knessetDark: C.mist },
  golden: { ridge: C.lilac, ridge2: C.peach, hills: C.sand, terrace: C.clay, grove: C.sageDeep, meadow: C.sage, meadow2: C.sageLight, front: C.sageDeep, front2: C.olive, knesset: C.blush, knessetDark: C.lilac },
  night: { ridge: C.plum, ridge2: C.dusk, hills: C.dusk, terrace: C.plum, grove: C.ink, meadow: C.sageDeep, meadow2: C.sage, front: C.ink, front2: C.sageDeep, knesset: C.dusk, knessetDark: C.plum },
};

// The palette colour closest to the midpoint of two others, for a middle sky band.
const PALETTE = Object.values(C);
function mixStep(a: string, b: string) {
  const h = (s: string) => [1, 3, 5].map((k) => parseInt(s.slice(k, k + 2), 16));
  const A = h(a);
  const B = h(b);
  const m = A.map((v, k) => (v + B[k]) / 2);
  let best = a;
  let bd = Infinity;
  for (const c of PALETTE) {
    const P = h(c);
    const d = (P[0] - m[0]) ** 2 + (P[1] - m[1]) ** 2 + (P[2] - m[2]) ** 2;
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

// Deterministic per-position noise.
const hash = (n: number) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};
const wave = (x: number, seed: number, amp: number) => Math.sin(x * 0.045 + seed) * amp + Math.sin(x * 0.11 + seed * 2.3) * amp * 0.45 + Math.sin(x * 0.023 + seed * 0.7) * amp * 0.8;

export type PaintOpts = {
  nodes: ArtNode[];
  voted: (i: number, v: boolean) => boolean;
  hour: number;
  species: string;
  levelIndex: number;
  stamps?: { voted?: boolean; witnessed?: boolean };
  crown: number;
};

export function paint(px: Pix, o: PaintOpts): Anchors {
  const { w: W, h: H } = px;
  const [, mood, bands] = skyAt(o.hour);
  const top = bands[0];
  const land = LAND[mood];
  const cx = Math.round(W / 2);

  // ---- sky ----
  const skyEnd = Math.round(H * 0.66);
  px.sky(0, skyEnd, bands, Math.max(3, Math.round(skyEnd / 22)));

  if (mood === "night") {
    for (let k = 0; k < Math.round((W * H) / 260); k++) {
      const x = Math.floor(hash(k + 1) * W);
      const y = Math.floor(hash(k + 77) * skyEnd * 0.8);
      px.set(x, y, hash(k + 9) > 0.8 ? C.white : C.pale);
    }
  }

  // Sun from the east (right) at 6:00 to the west (left) at 19:30; moon at night.
  const sunT = Math.min(1, Math.max(0, (o.hour - 6) / 13.5));
  const sx = Math.round(W * 0.88 - sunT * W * 0.76);
  const sy = Math.round(skyEnd * 0.82 - Math.sin(sunT * Math.PI) * skyEnd * 0.65);
  if (mood !== "night") {
    const r = Math.max(4, Math.round(W / 34));
    for (let y = sy - r * 3; y <= sy + r * 3; y++)
      for (let x = sx - r * 3; x <= sx + r * 3; x++) {
        const d = Math.hypot(x - sx, y - sy) / (r * 3);
        if (d < 1 && d > 0.34 && 1 - d > bayer(x, y) * 1.6) px.set(x, y, mood === "golden" ? C.goldLight : C.trayLight);
      }
    px.disc(sx, sy, r, mood === "golden" ? C.goldGlow : C.white);
  } else {
    const mx = Math.round(W * 0.22);
    const my = Math.round(skyEnd * 0.28);
    const r = Math.max(3, Math.round(W / 48));
    px.disc(mx, my, r, C.pale);
    px.disc(mx + Math.ceil(r * 0.55), my - Math.ceil(r * 0.35), r, top);
  }

  // ---- far ridge with the Knesset ----
  const ridgeY = (x: number) => H * 0.5 + wave(x, 1.3, H * 0.025);
  px.ridge(ridgeY, land.ridge, land.ridge2, 4);
  const kx = Math.round(W * 0.7);
  const ky = Math.round(ridgeY(kx + 10)) - 5;
  // The Knesset: a long low block, a colonnade, a flat roof; the flag on its pole.
  px.rect(kx - 1, ky - 1, 24, 1, land.knesset);
  px.rect(kx, ky, 22, 5, land.knesset);
  for (let i = 1; i < 22; i += 2) px.rect(kx + i, ky + 1, 1, 3, land.knessetDark);
  px.rect(kx - 2, ky + 5, 26, 1, land.knessetDark);
  const pole: [number, number] = [kx + 11, ky - 10];
  px.rect(pole[0], pole[1] - 9, 1, 9, land.knessetDark);

  // ---- Jerusalem hills, terraced ----
  const hillY = (x: number) => H * 0.585 + wave(x, 4.1, H * 0.03);
  px.ridge(hillY, land.hills);
  for (let k = 1; k <= 2; k++) {
    const off = k * Math.max(4, Math.round(H * 0.03));
    for (let x = 0; x < W; x++) if ((x + k * 5) % 7 < 4) px.set(x, Math.round(hillY(x) + off), land.terrace);
  }

  // ---- the grove: olives and cypresses ----
  const groveY = (x: number) => H * 0.69 + wave(x, 7.7, H * 0.012);
  px.ridge(groveY, land.meadow, land.meadow2, 3);
  const groveCount = 4 + Math.min(5, o.levelIndex);
  for (let k = 0; k < groveCount; k++) {
    const side = k % 2 ? 1 : -1;
    const x = Math.round(cx + side * (W * 0.24 + hash(k + 3) * W * 0.24));
    const y = Math.round(groveY(x));
    if (k % 3 === 2) {
      // cypress
      for (let j = 0; j < 9; j++) {
        const half = j < 2 ? 0 : j < 7 ? 1 : 0;
        px.rect(x - half, y - 9 + j, half * 2 + 1, 1, land.grove);
      }
    } else {
      px.rect(x, y - 2, 1, 3, land.grove);
      px.disc(x - 2, y - 4, 2, land.grove);
      px.disc(x + 2, y - 5, 2, land.grove);
      px.disc(x, y - 6, 2, land.grove);
    }
  }

  // ---- the foreground ----
  const frontY = (x: number) => H * 0.79 + wave(x, 2.2, H * 0.012);
  px.ridge(frontY, land.front, land.front2, 3);
  for (let k = 0; k < W / 3; k++) {
    const x = Math.floor(hash(k + 400) * W);
    const y = Math.round(frontY(x) + 2 + hash(k + 500) * (H - frontY(x) - 3));
    px.set(x, y, land.front2);
    px.set(x, y - 1, land.front2);
  }

  // Anemones (level 1+): red, a few white.
  if (o.levelIndex >= 1) {
    for (let k = 0; k < Math.round(W / 9); k++) {
      const x = Math.floor(hash(k + 900) * W);
      if (Math.abs(x - cx) < 16) continue;
      const y = Math.round(frontY(x) + 3 + hash(k + 950) * (H - frontY(x) - 5));
      const c = k % 5 === 4 ? C.white : C.anemone;
      px.set(x, y, c);
      px.set(x + 1, y, c);
      px.set(x, y - 1, c);
      px.set(x + 1, y - 1, mood === "night" ? c : C.red);
      px.set(x, y + 1, C.sageDeep);
    }
  }

  // ---- the ballot box: drawn in vector on top (see VectorLayer); here only its shadow ----
  const boxW = 34;
  const boxH = 22;
  const bx = cx - boxW / 2;
  const by = H - boxH - Math.max(3, Math.round(H * 0.035));
  for (let y = by + boxH - 3; y < by + boxH + 4; y++)
    for (let x = bx - 8; x < bx + boxW + 10; x++) {
      const d = Math.hypot((x - cx - 1) / 24, (y - by - boxH) / 3.5);
      if (d < 1 && 1 - d > bayer(x, y) * 0.9) px.set(x, y, C.brownDeep);
    }
  const slot: [number, number] = [cx, by];

  // ---- the tree ----
  const nodes = o.nodes;
  const anchors: Anchors = { gold: [], ghosts: [], names: [], slot, box: { x: bx, y: by, w: boxW, h: boxH }, flag: pole, clouds: [], mood };
  if (!nodes.length) return anchors;

  const root = stratify<ArtNode>()
    .id((d) => String(d.i))
    .parentId((d) => (d.p == null ? null : String(d.p)))(nodes) as HierarchyNode<ArtNode>;
  root.sum(() => 1);
  const height = Math.max(root.height, 1);
  d3tree<ArtNode>()
    .size([1, 1])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.4))(root);

  const people = nodes.filter((n) => !n.ghost).length;
  const total = root.value ?? 1;
  const trunkLen = Math.round(H * 0.15);
  const crownY = by - trunkLen;
  // An elliptical crown above the trunk. Order around the tree comes from the invite tree, so
  // families stay together; inner generations sit near the middle, outer ones toward the rim.
  const ry = Math.min((crownY - 4) * 0.5, H * 0.3) * o.crown;
  const rx = Math.min(W * 0.46, ry * 1.45);
  const ecx = cx;
  const ecy = crownY - ry * 0.55;
  const levels = Math.max(height, 1.6);
  const at = (d: HierarchyNode<ArtNode>): [number, number] => {
    if (d.depth === 0) return [cx, crownY];
    // angle: from below-left, over the top, to below-right (y up), leaving a wedge for the trunk
    const ang = Math.PI * (1.2 - 1.4 * (d.x ?? 0.5));
    const jitter = (hash(d.data.i * 3.1) - 0.5) * 0.22;
    const r = Math.min(1, Math.pow(d.depth / levels, 0.75) * (0.92 + jitter));
    return [ecx + Math.cos(ang) * rx * r, ecy - Math.sin(ang) * ry * r];
  };
  const trunkW = Math.max(5, Math.min(9, Math.round(3 + Math.sqrt(total) * 0.5)));
  const k = trunkW / Math.sqrt(total);
  const width = (d: HierarchyNode<ArtNode>) => Math.max(1, Math.min(trunkW - 1, Math.round(k * Math.sqrt(d.value ?? 1))));
  const clusterR = people > 200 ? 1.6 : people > 90 ? 2.2 : people > 35 ? 3 : people > 12 ? 4 : 5;
  const lx = mood === "night" ? 0 : Math.sign(sx - cx) || 1; // light comes from the sun's side

  // trunk: shaded edge away from the light, a highlight toward it, bark flecks
  for (let y = crownY; y <= by + 1; y++) {
    const flare = y > by - 4 ? 1 : 0;
    const half = Math.floor(trunkW / 2) + flare;
    for (let x = cx - half; x <= cx + half; x++) {
      const t = (x - cx) / (half || 1);
      const c = t * lx < -0.4 ? BARK.deep : t * lx > 0.45 ? BARK.light : BARK.mid;
      px.set(x, y, c);
    }
    if (hash(y) > 0.7) px.set(cx - lx, y, BARK.deep);
  }

  // branches, inner first
  const all = root.descendants();
  for (const d of all) {
    if (!d.parent) continue;
    const [x0, y0] = at(d.parent);
    const [x1, y1] = at(d);
    const w = width(d);
    // Bend: leave the parent heading up, arrive travelling outward.
    const qx = x0 + (x1 - x0) * 0.3;
    const qy = y0 + (y1 - y0) * 0.8 - (d.parent.depth === 0 ? ry * 0.25 : 0);
    const steps = Math.max(4, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
    let px0 = x0;
    let py0 = y0;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      const bx1 = u * u * x0 + 2 * u * t * qx + t * t * x1;
      const by1 = u * u * y0 + 2 * u * t * qy + t * t * y1;
      if (d.data.ghost) {
        if (s % 2) px.set(bx1, by1, C.goldLight);
      } else {
        px.line(px0, py0, bx1, by1, w, BARK.deep);
        if (w >= 2) px.line(px0 + lx * 0.5, py0 - 0.5, bx1 + lx * 0.5, by1 - 0.5, w - 1, BARK.mid);
      }
      px0 = bx1;
      py0 = by1;
    }
  }

  // leaf clusters, outer generations last so they sit on top
  const shades = SPECIES_PIX[o.species] ?? SPECIES_PIX.olive;
  // First a shaded canopy mass behind everyone past the first generation, so a big tree reads as
  // one crown rather than a fan of sticks.
  if (people > 3) {
    for (const d of all) {
      if (d.depth < 1 || d.data.ghost) continue;
      const [x, y] = at(d);
      px.disc(x, y, clusterR * (people > 90 ? 2.6 : 2.1), shades.deep, mood === "night" ? C.ink : shades.shadow, lx * -1, 0.8);
    }
  }
  const sorted = [...all].filter((d) => d.depth > 0).sort((a, b) => a.depth - b.depth);
  for (const d of sorted) {
    const [x, y] = at(d);
    const rx = Math.round(x);
    const ry = Math.round(y);
    if (d.data.ghost) {
      anchors.ghosts.push([rx, ry, Math.max(2, Math.round(clusterR))]);
      continue;
    }
    const on = o.voted(d.data.i, d.data.v);
    const s = on ? GOLD : shades;
    const r = d.children ? Math.max(1.5, clusterR * 0.8) : clusterR;
    // A cluster: a lit disc, a smaller offset clump, a highlight toward the light.
    px.disc(rx, ry, r, s.mid, s.deep, -lx, -0.6);
    px.disc(rx + (d.data.i % 2 ? 1 : -1) * Math.round(r * 0.7), ry + Math.round(r * 0.4), Math.max(1, r * 0.6), s.mid, s.deep, -lx, -0.6);
    px.disc(rx + lx * Math.round(r * 0.35), ry - Math.round(r * 0.35), Math.max(0.6, r * 0.4), s.light);
    px.set(rx + lx * Math.round(r * 0.45), ry - Math.round(r * 0.5), s.hi);
    if (shades.fruit && !on && d.data.i % 3 === 1) {
      px.set(rx - 1, ry + 1, shades.fruit);
      px.set(rx, ry + 1, shades.fruit);
      px.set(rx - 1, ry + 2, C.red);
      px.set(rx, ry + 2, C.red);
    }
    if (on) anchors.gold.push([rx, ry]);
    if (d.depth === 1 && d.data.n && people <= 40) anchors.names.push({ x: rx, y: ry - r - 2, text: d.data.n });
  }

  // A new tree is a sapling, not a stump: a small crown of its own at the top of the trunk.
  if (people <= 1) {
    const r = Math.max(4, Math.round(W / 32));
    px.disc(cx, crownY - r * 0.6, r, shades.mid, shades.deep, -lx, -0.6);
    px.disc(cx - r * 0.9, crownY + 1, r * 0.7, shades.mid, shades.deep, -lx, -0.6);
    px.disc(cx + r * 0.9, crownY, r * 0.7, shades.mid, shades.deep, -lx, -0.6);
    px.disc(cx + lx * r * 0.3, crownY - r, r * 0.4, shades.light);
    px.set(cx + lx * Math.round(r * 0.4), crownY - r - 1, shades.hi);
  }

  // a hoopoe, Israel's national bird, on the trunk side (level 3+)
  if (o.levelIndex >= 3) {
    px.sprite(
      cx + Math.ceil(trunkW / 2) + 1,
      crownY + Math.round(trunkLen * 0.3),
      ["..k.k..", ".kokok.", "..ooo..", ".oowwk.", "ooooow.", ".kk....", "..k...."],
      { k: C.ink, o: C.sand, w: C.white },
      lx < 0,
    );
  }

  // the root: you, a tag on the trunk
  anchors.names.push({ x: cx, y: crownY + Math.round(trunkLen * 0.75), text: "אני", me: true, gold: o.voted(nodes[0].i, nodes[0].v) });

  return anchors;
}
