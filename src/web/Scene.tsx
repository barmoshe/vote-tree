import { useEffect, useMemo, useRef, useState } from "react";
import type { TreeNode } from "../shared/api";
import { C, Pix } from "./pixel/canvas";
import { GOLD, SPECIES_PIX, paint, type Anchors, type ArtNode } from "./pixel/scene";

// The election-day scene in pixel art. A static layer is painted once per size, hour and tree;
// a light overlay animates at 8 fps (gold sparkles, clouds, the flag, butterflies, the envelope).
// The canvas runs at an integer scale (2-6 screen pixels per art pixel) so every pixel is square.

export function israelHour() {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") + get("minute") / 60;
}

/** The current Israel hour, refreshed every minute. */
export function useIsraelHour() {
  const [h, setH] = useState(israelHour);
  useEffect(() => {
    const t = setInterval(() => setH(israelHour()), 60_000);
    return () => clearInterval(t);
  }, []);
  return h;
}

const reduced = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const ART_W = 180; // target width in art pixels
const ART_H = 140; // and height

type Props = {
  nodes: TreeNode[];
  label: string;
  hour?: number;
  species?: string;
  levelIndex?: number;
  votedAt?: (i: number) => boolean;
  showNames?: boolean;
  ghosts?: number;
  ballots?: number;
  stamps?: { voted?: boolean; witnessed?: boolean };
  crown?: number;
  animate?: boolean;
  className?: string;
};

export function Scene({
  nodes,
  label,
  hour,
  species = "olive",
  levelIndex = 0,
  votedAt,
  showNames = true,
  ghosts = 0,
  ballots = 0,
  stamps,
  crown = 1,
  animate = true,
  className = "",
}: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const now = useIsraelHour();
  const h = hour ?? now;
  const [size, setSize] = useState<{ w: number; h: number; s: number } | null>(null);
  const [anchors, setAnchors] = useState<Anchors | null>(null);
  const bg = useRef<HTMLCanvasElement | null>(null);

  const all = useMemo<ArtNode[]>(() => (ghosts ? [...nodes, ...Array.from({ length: ghosts }, (_, k) => ({ i: 100_000 + k, p: 0, v: false, ghost: true }))] : nodes), [nodes, ghosts]);
  // votedAt changes identity every render in the demo; key the paint on what it answers instead.
  const votedKey = votedAt ? all.map((n) => (votedAt(n.i) ? 1 : 0)).join("") : "";

  // Size: pick an integer scale, then the art resolution that fills the box.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      // The tighter of width and height sets the pixel size, so a wide hero becomes a panorama.
      const s = Math.max(2, Math.round(Math.min(r.width / ART_W, r.height / ART_H)));
      setSize({ w: Math.ceil(r.width / s), h: Math.ceil(r.height / s), s });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Paint the static layer.
  useEffect(() => {
    if (!size) return;
    const px = new Pix(size.w, size.h);
    const a = paint(px, {
      nodes: all,
      voted: (i, v) => (votedAt ? votedAt(i) : v),
      hour: h,
      species,
      levelIndex,
      stamps,
      crown,
    });
    const off = document.createElement("canvas");
    off.width = size.w;
    off.height = size.h;
    off.getContext("2d")!.putImageData(px.img, 0, 0);
    bg.current = off;
    setAnchors(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, all, votedKey, Math.floor(h * 2), species, levelIndex, stamps?.voted, stamps?.witnessed, crown]);

  // A new envelope drops whenever the count rises.
  const [drop, setDrop] = useState(0);
  const lastBallots = useRef(ballots);
  useEffect(() => {
    if (ballots > lastBallots.current) setDrop((d) => d + 1);
    lastBallots.current = ballots;
  }, [ballots]);

  // Animate only while the scene is on screen.
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // The overlay loop.
  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !size || !anchors || !bg.current) return;
    cv.width = size.w;
    cv.height = size.h;
    const g = cv.getContext("2d")!;
    g.imageSmoothingEnabled = false;
    const still = !animate || reduced() || !visible;
    let frame = 0;
    let timer = 0;
    const dot = (x: number, y: number, c: string) => {
      g.fillStyle = c;
      g.fillRect(Math.round(x), Math.round(y), 1, 1);
    };
    const draw = () => {
      g.drawImage(bg.current!, 0, 0);
      const t = frame;
      // clouds drift by whole pixels
      if (anchors.mood !== "night") {
        const cw = size.w;
        [
          [0.18, 0.16, 0],
          [0.62, 0.1, 37],
        ].forEach(([fx, fy, off]) => {
          const x = ((fx * cw + (t + off) / 6) % (cw + 30)) - 15;
          const y = Math.round(fy * size.h);
          g.fillStyle = C.white;
          g.fillRect(Math.round(x), y, 12, 2);
          g.fillRect(Math.round(x) + 3, y - 1, 6, 1);
          g.fillStyle = anchors.mood === "golden" ? C.blush : C.pale;
          g.fillRect(Math.round(x) + 1, y + 2, 11, 1);
        });
      }
      // gold clusters glint, a few at a time
      anchors.gold.forEach(([x, y], k) => {
        const phase = (t + k * 7) % 24;
        if (phase === 0 || phase === 1) {
          dot(x, y, C.white);
          if (phase === 0) {
            dot(x - 1, y, GOLD.hi);
            dot(x + 1, y, GOLD.hi);
            dot(x, y - 1, GOLD.hi);
            dot(x, y + 1, GOLD.hi);
          }
        }
      });
      // butterflies (level 2+)
      if (levelIndex >= 2 && anchors.mood !== "night") {
        [0, 1].forEach((b) => {
          const p = (t / 40 + b * 0.5) % 1;
          const x = size.w * (0.15 + 0.7 * p);
          const y = size.h * (0.62 + 0.06 * Math.sin(p * 12 + b));
          const c = b ? C.goldLight : C.white;
          const open = t % 2 === 0;
          dot(x, y, C.ink);
          dot(x - 1, y - (open ? 1 : 0), c);
          dot(x + 1, y - (open ? 1 : 0), c);
        });
      }
    };
    draw();
    if (still) return;
    const tick = () => {
      if (!document.hidden) {
        frame++;
        draw();
      }
      timer = window.setTimeout(tick, 125);
    };
    timer = window.setTimeout(tick, 125);
    return () => clearTimeout(timer);
  }, [size, anchors, animate, levelIndex, visible]);

  return (
    <div ref={wrap} className={`scene ${className}`} role="img" aria-label={label}>
      {size && (
        <div className="scene-stage" style={{ width: size.w * size.s, height: size.h * size.s }}>
          <canvas ref={canvas} className="scene-canvas" aria-hidden="true" />
          {anchors && <VectorLayer a={anchors} w={size.w} h={size.h} stamps={stamps} drop={drop} />}
          {anchors && (
            <div className="scene-names" aria-hidden="true">
              {anchors.names
                .filter((n) => n.me || (showNames && anchors.names.length <= 13))
                .map((n, k) => (
                  <span key={k} className={n.me ? (n.gold ? "me gold" : "me") : undefined} style={{ left: n.x * size.s, top: n.y * size.s }}>
                    {n.text}
                  </span>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// The vector layer: crisp objects on the pixel world, in the same palette and coordinates, with
// line weights of one world pixel so they sit in the scene instead of floating over it.
function VectorLayer({ a, w, h, stamps, drop }: { a: Anchors; w: number; h: number; stamps?: { voted?: boolean; witnessed?: boolean }; drop: number }) {
  const { x, y, w: bw, h: bh } = a.box;
  const cx = x + bw / 2;
  return (
    <svg className="scene-vector" viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {a.flag && (
        <g transform={`translate(${a.flag[0] + 0.5},${a.flag[1]})`}>
          <g className="v-flag">
            <rect width="11" height="8" fill={C.white} stroke={C.ink} strokeWidth="0.5" />
            <rect y="1" width="11" height="1.1" fill={C.blue} />
            <rect y="5.9" width="11" height="1.1" fill={C.blue} />
            <path d="M5.5,2.55 L6.75,4.7 L4.25,4.7Z M5.5,5.45 L4.25,3.3 L6.75,3.3Z" fill="none" stroke={C.blue} strokeWidth="0.42" strokeLinejoin="round" />
          </g>
        </g>
      )}

      {/* empty invite slots: dashed gold circles with a plus, waiting for a friend */}
      {a.ghosts.map(([gx, gy, r], k) => (
        <g key={k} transform={`translate(${gx},${gy})`} className="v-ghost" style={{ animationDelay: `${k * 0.3}s` }}>
          <circle r={Math.max(4, r + 1.5)} fill="rgb(255 255 255 / 0.6)" stroke={C.amber} strokeWidth="0.8" strokeDasharray="1.6 1.2" />
          <path d="M-1.8,0 H1.8 M0,-1.8 V1.8" stroke={C.amber} strokeWidth="0.9" strokeLinecap="round" />
        </g>
      ))}

      {/* the cardboard ballot box */}
      <g strokeLinejoin="round">
        <path d={`M${x + bw},${y + 3} L${x + bw + 4},${y + 1} L${x + bw + 4},${y + bh - 2} L${x + bw},${y + bh}Z`} fill={C.pale} stroke={C.ink} strokeWidth="1" />
        <rect x={x} y={y + 3} width={bw} height={bh - 3} fill={C.white} stroke={C.ink} strokeWidth="1" />
        <path d={`M${x - 1},${y + 3} L${x + 3},${y} L${x + bw + 4},${y} L${x + bw},${y + 3}Z`} fill={C.blue} stroke={C.ink} strokeWidth="1" />
        <rect x={x - 1} y={y + 3} width={bw + 1} height="2" fill={C.navy} stroke={C.ink} strokeWidth="1" />
        <rect x={cx - 6} y={y + 1.1} width="13" height="1.1" fill={C.ink} />
        <rect x={x + 6} y={y + 8} width={bw - 12} height="10" fill={C.white} stroke={C.ink} strokeWidth="0.6" />
        <rect x={x + 6} y={y + 9.2} width={bw - 12} height="0.9" fill={C.blue} />
        <rect x={x + 6} y={y + 15.9} width={bw - 12} height="0.9" fill={C.blue} />
        <text x={cx} y={y + 14.4} textAnchor="middle" className="v-label">
          קלפי
        </text>
      </g>
      {stamps?.voted && (
        <g transform={`translate(${x + 7},${y + bh - 2.5}) rotate(-10)`} className="v-stamp">
          <rect x="-7" y="-2.6" width="14" height="5.2" rx="1" fill="none" stroke={C.red} strokeWidth="0.6" />
          <text textAnchor="middle" y="1.3" className="v-stamp-text">
            הצבעתי
          </text>
        </g>
      )}
      {stamps?.witnessed && (
        <g transform={`translate(${x + bw - 5},${y + bh - 3.5}) rotate(12)`} className="v-stamp">
          <circle r="3.4" fill="none" stroke={C.red} strokeWidth="0.6" />
          <text textAnchor="middle" y="1.2" className="v-stamp-text">
            עד
          </text>
        </g>
      )}
      {drop > 0 && (
        <g key={drop} transform={`translate(${cx - 4},${y - 4})`}>
          <g className="v-envelope">
            <rect width="8" height="5" fill={C.royal} stroke={C.ink} strokeWidth="0.5" />
            <path d="M0,0 L4,2.8 L8,0" fill="none" stroke={C.trayLight} strokeWidth="0.5" />
          </g>
        </g>
      )}
    </svg>
  );
}

// A 9x9 pixel leaf, in a species' shades or in gold.
const LEAF_SPRITE = ["....hh...", "...hll...", "..hllmm..", ".hllmmm..", ".lmmmmd..", "..mmmdd..", "..dmdd...", ".d.dd....", "d........"];

export function LeafChip({ species, size = 34, gold = false }: { species: string; size?: number; gold?: boolean }) {
  const s = gold ? GOLD : (SPECIES_PIX[species] ?? SPECIES_PIX.olive);
  const key: Record<string, string> = { h: s.hi, l: s.light, m: s.mid, d: s.deep };
  const rects: { x: number; y: number; c: string }[] = [];
  LEAF_SPRITE.forEach((row, y) => [...row].forEach((ch, x) => key[ch] && rects.push({ x, y, c: key[ch] })));
  return (
    <svg width={size} height={size} viewBox="0 0 9 9" shapeRendering="crispEdges" aria-hidden="true" className="leafchip">
      {rects.map((r, k) => (
        <rect key={k} x={r.x} y={r.y} width="1" height="1" fill={r.c} />
      ))}
    </svg>
  );
}
