import { useEffect, useId, useMemo, useState } from "react";
import { stratify, tree as d3tree } from "d3-hierarchy";
import type { TreeNode } from "../shared/api";
import { speciesById } from "../shared/game";

// The game's one picture, an Israeli election day in paper and cardboard: Jerusalem hills under a
// sky that follows the hour, the Knesset on the horizon, and the player's tree growing out of a
// cardboard ballot box. Its leaves are blank paper ballot slips (never letters: party symbols are
// letters): tinted by species when someone joined, gold once they voted. Blue envelopes fly into
// the slot as votes land. Decorations grow with the level.

const W = 800;
const H = 600;
const CX = 400;
const BOX_TOP = 468; // the ballot box's lid
const CY = 436; // where the trunk splits into the crown
const MAX_R = 300;
const SPAN_FROM = Math.PI * 1.08;
const SPAN_TO = Math.PI * 1.92;

type N = TreeNode & { ghost?: boolean };
type Placed = { i: number; x: number; y: number; a: number; r: number; depth: number; v: boolean; n?: string; ghost?: boolean; parent?: Placed };

const polar = (a: number, r: number): [number, number] => [CX + r * Math.cos(a), CY + r * Math.sin(a)];

function layout(nodes: N[], maxR: number) {
  const root = stratify<N>()
    .id((d) => String(d.i))
    .parentId((d) => (d.p == null ? null : String(d.p)))(nodes);
  const ring = maxR / Math.max(root.height, 2.2);
  d3tree<N>()
    .size([SPAN_TO - SPAN_FROM, 1])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.6) / Math.max(1, a.depth))(root);
  const placed: Placed[] = [];
  const byId = new Map<string, Placed>();
  root.each((d) => {
    const a = SPAN_FROM + (d.x ?? 0);
    const r = d.depth * ring;
    const [x, y] = polar(a, r);
    const p: Placed = { i: d.data.i, x, y, a, r, depth: d.depth, v: d.data.v, n: d.data.n, ghost: d.data.ghost, parent: d.parent ? byId.get(d.parent.id!) : undefined };
    byId.set(d.id!, p);
    placed.push(p);
  });
  return placed;
}

function branch(p: Placed) {
  const par = p.parent!;
  const mid = (par.r + p.r) / 2;
  const [x1, y1] = par.depth === 0 ? [CX, CY - p.r * 0.5] : polar(par.a, mid);
  const [x2, y2] = polar(p.a, mid);
  const f = (n: number) => n.toFixed(1);
  return `M${f(par.x)},${f(par.y)} C${f(x1)},${f(y1)} ${f(x2)},${f(y2)} ${f(p.x)},${f(p.y)}`;
}

// ---- sky by hour ----

const SKY: [number, string, string][] = [
  [0, "#0b1a3a", "#1d2f5c"],
  [5, "#14244d", "#3b3f75"],
  [6, "#5a6db3", "#f2a07b"],
  [7.5, "#7fb1e8", "#f6d8b0"],
  [10, "#5fa3ec", "#cfe6fb"],
  [16, "#6aa9ea", "#d8ecfb"],
  [18, "#5b7fc4", "#f5b27a"],
  [19.3, "#3a3f7a", "#e07a6a"],
  [20.5, "#16244d", "#33417a"],
  [24, "#0b1a3a", "#1d2f5c"],
];
function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((k) => parseInt(a.slice(k, k + 2), 16));
  const pb = [1, 3, 5].map((k) => parseInt(b.slice(k, k + 2), 16));
  return "#" + pa.map((v, k) => Math.round(v + (pb[k] - v) * t).toString(16).padStart(2, "0")).join("");
}
function skyAt(h: number): [string, string] {
  for (let k = 0; k < SKY.length - 1; k++) {
    const [h0, t0, b0] = SKY[k];
    const [h1, t1, b1] = SKY[k + 1];
    if (h >= h0 && h <= h1) {
      const t = (h - h0) / (h1 - h0);
      return [mix(t0, t1, t), mix(b0, b1, t)];
    }
  }
  return [SKY[0][1], SKY[0][2]];
}
const isNight = (h: number) => h < 5.6 || h > 20.2;

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

// ---- the paper slip ----

// A blank ballot slip pointing along +x, with a folded corner. Drawn around its stem at (0,0).
const SLIP = "M2,-8 L24,-8 L28,-4 L28,8 L2,8 Z";
const FOLD = "M24,-8 L24,-4 L28,-4";

// A per-index wobble so slips don't sit like a grid.
const wobble = (i: number) => (((i * 47) % 23) - 11) * 1.4;

type Props = {
  nodes: TreeNode[];
  label: string;
  hour?: number;
  species?: string;
  levelIndex?: number;
  votedAt?: (i: number) => boolean;
  showNames?: boolean;
  ghosts?: number; // empty invite slots drawn as dashed slips
  ballots?: number; // envelopes already in the box; a rise animates a new one in
  stamps?: { voted?: boolean; witnessed?: boolean };
  crown?: number; // 0..1, shrinks the crown to leave sky for a title
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
  const gid = useId().replace(/:/g, "");
  const now = useIsraelHour();
  const h = hour ?? now;
  const sp = speciesById(species);

  const withGhosts = useMemo<N[]>(() => {
    if (!ghosts) return nodes;
    return [...nodes, ...Array.from({ length: ghosts }, (_, k) => ({ i: 100_000 + k, p: 0, v: false, ghost: true }))];
  }, [nodes, ghosts]);
  const placed = useMemo(() => layout(withGhosts, MAX_R * crown), [withGhosts, crown]);

  const voted = (p: Placed) => !p.ghost && (votedAt ? votedAt(p.i) : p.v);
  const direct = placed.filter((p) => p.depth === 1 && !p.ghost);
  const n = placed.length;
  const slipScale = n > 160 ? 0.62 : n > 80 ? 0.78 : n > 40 ? 0.95 : 1.2;

  const [top, bottom] = skyAt(h);
  const night = isNight(h);
  const sunT = Math.min(1, Math.max(0, (h - 6) / 13.5));
  const sunX = 720 - sunT * 640;
  const sunY = 300 - Math.sin(sunT * Math.PI) * 230;
  const moonT = Math.min(1, h >= 19 ? (h - 19) / 11 : (h + 5) / 11);
  const moonX = 700 - moonT * 600;
  const moonY = 260 - Math.sin(moonT * Math.PI) * 190;

  // A new envelope flies in whenever the count rises.
  const [drop, setDrop] = useState(0);
  const [seen, setSeen] = useState(ballots);
  useEffect(() => {
    if (ballots > seen) setDrop((d) => d + 1);
    setSeen(ballots);
  }, [ballots, seen]);

  const kraft = night ? "oklch(0.5 0.05 70)" : "oklch(0.72 0.08 70)";
  const kraftDark = night ? "oklch(0.42 0.05 65)" : "oklch(0.6 0.08 65)";

  return (
    <svg className={`scene ${animate ? "scene-anim" : ""} ${className}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id={`sky${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
        <radialGradient id={`sun${gid}`}>
          <stop offset="0.35" stopColor="#fff6d6" />
          <stop offset="0.6" stopColor="#ffd36b" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffd36b" stopOpacity="0" />
        </radialGradient>
        <pattern id={`corr${gid}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill={kraft} />
          <rect width="2" height="6" fill={kraftDark} opacity="0.35" />
        </pattern>
        <g id={`slip${gid}`}>
          <path d={SLIP} />
          <path d={FOLD} fill="none" stroke="oklch(0.3 0.04 262 / 0.35)" strokeWidth="1" />
        </g>
      </defs>

      {/* sky, stars, sun or moon, clouds */}
      <rect width={W} height={H} fill={`url(#sky${gid})`} />
      <g className="stars" style={{ opacity: night ? 1 : 0 }}>
        {[[90, 60], [180, 120], [260, 40], [520, 70], [610, 130], [700, 50], [350, 90], [460, 30], [140, 180], [660, 200]].map(([x, y], k) => (
          <circle key={k} cx={x} cy={y} r={k % 3 ? 1.4 : 2} fill="#fff" className="twinkle" style={{ animationDelay: `${k * 0.37}s` }} />
        ))}
      </g>
      {!night && <circle cx={sunX} cy={sunY} r="70" fill={`url(#sun${gid})`} />}
      {night && (
        <g transform={`translate(${moonX},${moonY})`}>
          <circle r="22" fill="#f4f1e3" />
          <circle r="22" cx="9" cy="-6" fill={top} />
        </g>
      )}
      <g fill="#fff" opacity={night ? 0.12 : 0.85}>
        <g className="cloud c1">
          <ellipse cx="140" cy="110" rx="46" ry="16" />
          <ellipse cx="170" cy="98" rx="30" ry="18" />
        </g>
        <g className="cloud c2">
          <ellipse cx="560" cy="80" rx="54" ry="15" />
          <ellipse cx="590" cy="70" rx="28" ry="16" />
        </g>
      </g>

      {/* far hills with the Knesset and its flag */}
      <path d="M0,380 C120,330 220,350 320,340 C430,328 520,300 640,318 C710,328 760,320 800,312 L800,600 L0,600Z" fill="oklch(0.74 0.04 250)" opacity={night ? 0.55 : 0.9} />
      <g transform="translate(590,282)" aria-hidden="true">
        <g fill={night ? "oklch(0.42 0.04 250)" : "oklch(0.6 0.04 250)"}>
          <rect x="0" y="16" width="92" height="22" />
          <rect x="-4" y="12" width="100" height="5" />
          <rect x="-10" y="38" width="112" height="6" />
        </g>
        {Array.from({ length: 9 }, (_, k) => (
          <rect key={k} x={4 + k * 10.2} y="17" width="3" height="21" fill={night ? "oklch(0.3 0.03 250)" : "oklch(0.52 0.04 250)"} />
        ))}
        <line x1="46" y1="12" x2="46" y2="-14" stroke={night ? "oklch(0.42 0.04 250)" : "oklch(0.5 0.03 250)"} strokeWidth="1.5" />
        <g transform="translate(46,-14)" className="flag">
          <rect width="16" height="11" fill="#fff" />
          <rect y="1.5" width="16" height="1.6" fill="var(--flag)" />
          <rect y="7.9" width="16" height="1.6" fill="var(--flag)" />
        </g>
      </g>

      {/* terraced middle hills */}
      <path d="M0,430 C140,392 260,410 380,400 C520,388 640,372 800,392 L800,600 L0,600Z" fill={night ? "oklch(0.36 0.05 140)" : "oklch(0.66 0.08 130)"} />
      <g stroke={night ? "oklch(0.3 0.04 140)" : "oklch(0.58 0.07 125)"} strokeWidth="2" fill="none" opacity="0.7">
        <path d="M20,446 C150,414 260,428 380,420 C520,410 640,396 790,414" />
        <path d="M10,470 C150,440 260,452 380,446 C520,436 640,424 790,440" />
      </g>
      {levelIndex >= 4 &&
        [90, 160, 690, 740, 230].slice(0, levelIndex >= 5 ? 5 : 3).map((x, k) => (
          <g key={x} transform={`translate(${x},${424 - (k % 2) * 8}) scale(${0.7 + (k % 3) * 0.12})`}>
            <rect x="-2" y="0" width="4" height="16" fill="var(--bark)" />
            <circle cy="-6" r="14" fill={night ? "oklch(0.4 0.07 145)" : "oklch(0.55 0.11 145)"} />
          </g>
        ))}

      {/* the front hill */}
      <path d="M0,520 C160,478 300,486 400,486 C520,486 640,474 800,500 L800,600 L0,600Z" fill={night ? "oklch(0.32 0.06 135)" : "oklch(0.6 0.11 132)"} />
      <path d="M0,566 C200,536 600,546 800,554 L800,600 L0,600Z" fill={night ? "oklch(0.27 0.05 135)" : "oklch(0.54 0.11 132)"} />

      {/* anemones, Israel's red winter flower (level 1+) */}
      {levelIndex >= 1 &&
        [[120, 528], [160, 540], [250, 512], [560, 518], [640, 532], [700, 520], [300, 556], [520, 560]].map(([x, y], k) => (
          <g key={k} transform={`translate(${x},${y})`}>
            <line y2="10" stroke="oklch(0.45 0.1 140)" strokeWidth="1.5" />
            <circle r="5" fill={k % 3 === 2 ? "#f5f0e6" : "var(--anemone)"} />
            <circle r="1.8" fill="#2a1a2e" />
          </g>
        ))}

      {/* trunk, rising out of the ballot box's slot */}
      <path d={`M${CX - 12},${BOX_TOP + 4} C${CX - 8},${CY + 18} ${CX - 6},${CY + 6} ${CX - 4},${CY} L${CX + 4},${CY} C${CX + 6},${CY + 6} ${CX + 8},${CY + 18} ${CX + 12},${BOX_TOP + 4} Z`} fill="var(--bark)" />

      {/* the crown sways a little */}
      <g className="crown">
        <g fill="none" stroke="var(--bark)" strokeLinecap="round">
          {placed
            .filter((p) => p.parent)
            .map((p, k) => (
              <path key={p.i} d={branch(p)} strokeWidth={Math.max(1.4, 8 - p.depth * 1.8)} className={p.ghost ? "branch ghost-branch" : "branch"} style={{ animationDelay: `${Math.min(k * 12, 900)}ms` }} />
            ))}
        </g>
        {placed
          .filter((p) => p.depth > 0)
          .map((p, k) => {
            const on = voted(p);
            const deg = (p.a * 180) / Math.PI + wobble(p.i);
            return (
              <g key={p.i} transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`} className={"slip" + (on ? " slip-on" : "") + (p.ghost ? " slip-ghost" : "")} style={{ animationDelay: `${200 + Math.min(k * 14, 1100)}ms` }}>
                <g transform={`rotate(${deg.toFixed(1)}) scale(${(p.depth === 1 ? 1.12 : 1) * slipScale})`}>
                  {p.ghost ? (
                    <path d={SLIP} fill="oklch(1 0 0 / 0.4)" stroke="var(--ink)" strokeWidth="1.4" strokeDasharray="3 3" />
                  ) : (
                    <use href={`#slip${gid}`} fill={on ? "var(--gold)" : sp.leaf} stroke={on ? "var(--gold-deep)" : sp.edge} strokeWidth="1.3" />
                  )}
                </g>
              </g>
            );
          })}
        {/* a hoopoe, Israel's national bird, on the first branch (level 3+) */}
        {levelIndex >= 3 && direct[0] && (
          <g transform={`translate(${((direct[0].x + CX) / 2).toFixed(1)},${((direct[0].y + CY) / 2 - 10).toFixed(1)})`} className="hoopoe" aria-hidden="true">
            <ellipse rx="11" ry="7" fill="oklch(0.72 0.11 60)" />
            <path d="M-6,-4 L-12,-14 L-8,-6 L-4,-16 L-2,-6 L2,-15 L1,-5Z" fill="oklch(0.72 0.11 60)" stroke="#2a2a2a" strokeWidth="0.6" />
            <path d="M3,0 L14,2 L3,4" fill="#2a2a2a" />
            <path d="M-11,1 L-2,1 L-6,6Z" fill="#2a2a2a" />
            <path d="M-9,2 L-4,2" stroke="#fff" strokeWidth="1.2" />
            <circle cx="5" cy="-2" r="1.2" fill="#111" />
          </g>
        )}
      </g>

      {showNames &&
        direct.length <= 12 &&
        direct.map((p) => {
          const [lx, ly] = polar(p.a, p.r + 26 + 16 * slipScale);
          return (
            <text key={`n${p.i}`} x={lx} y={ly} className="tree-name" textAnchor="middle" dominantBaseline="middle">
              {p.n}
            </text>
          );
        })}

      {/* butterflies (level 2+) */}
      {levelIndex >= 2 &&
        [0, 1].map((k) => (
          <g key={k} className={`butterfly b${k}`} aria-hidden="true">
            <path d="M0,0 C-8,-10 -14,-2 -2,2 C-12,6 -6,12 0,2 C6,12 12,6 2,2 C14,-2 8,-10 0,0Z" fill={k ? "oklch(0.8 0.14 85)" : "var(--flag-soft)"} stroke="var(--ink)" strokeWidth="0.6" />
          </g>
        ))}

      {/* the cardboard ballot box: the tree's planter */}
      <g className="box">
        <path d={`M${CX - 70},${BOX_TOP + 10} L${CX + 70},${BOX_TOP + 10} L${CX + 78},${BOX_TOP + 104} L${CX - 78},${BOX_TOP + 104} Z`} fill={`url(#corr${gid})`} stroke="var(--ink)" strokeWidth="2.5" strokeLinejoin="round" />
        <rect x={CX - 76} y={BOX_TOP} width="152" height="14" rx="3" fill="var(--flag)" stroke="var(--ink)" strokeWidth="2.5" />
        <rect x={CX - 26} y={BOX_TOP + 4} width="52" height="5" rx="2.5" fill="var(--ink)" />
        <rect x={CX - 52} y={BOX_TOP + 36} width="104" height="38" rx="4" fill="#fbfaf6" stroke="var(--ink)" strokeWidth="1.8" />
        <rect x={CX - 52} y={BOX_TOP + 41} width="104" height="3" fill="var(--flag)" />
        <rect x={CX - 52} y={BOX_TOP + 66} width="104" height="3" fill="var(--flag)" />
        <text x={CX} y={BOX_TOP + 58} textAnchor="middle" className="box-label">
          {ballots > 0 ? `קלפי · ${ballots}` : "קלפי"}
        </text>
        {stamps?.voted && (
          <g transform={`translate(${CX - 44},${BOX_TOP + 86}) rotate(-12)`} className="stamp">
            <rect x="-34" y="-12" width="68" height="24" rx="5" fill="none" stroke="var(--flag)" strokeWidth="2.5" />
            <text textAnchor="middle" dominantBaseline="central" className="stamp-text">
              הצבעתי
            </text>
          </g>
        )}
        {stamps?.witnessed && (
          <g transform={`translate(${CX + 44},${BOX_TOP + 88}) rotate(9)`} className="stamp">
            <circle r="17" fill="none" stroke="var(--anemone)" strokeWidth="2.5" />
            <text textAnchor="middle" dominantBaseline="central" className="stamp-text stamp-red">
              עד
            </text>
          </g>
        )}
      </g>

      {/* a blue envelope flies into the slot */}
      {drop > 0 && (
        <g key={drop} className="envelope" aria-hidden="true">
          <g transform={`translate(${CX - 15},${BOX_TOP - 2})`}>
            <rect width="30" height="20" rx="2" fill="var(--flag)" stroke="var(--ink)" strokeWidth="1.4" />
            <path d="M0,0 L15,11 L30,0" fill="none" stroke="#fff" strokeWidth="1.3" />
          </g>
        </g>
      )}

      {/* you, where the crown begins */}
      <g transform={`translate(${CX},${CY})`}>
        <circle r="20" fill={placed[0] && voted(placed[0]) ? "var(--gold)" : "var(--flag)"} stroke="#fff" strokeWidth="3" />
        <text className="tree-me" textAnchor="middle" dominantBaseline="central">
          אני
        </text>
      </g>
    </svg>
  );
}

/** A small slip in a species' colours, for the species picker and the podium. */
export function LeafChip({ species, size = 34, gold = false }: { species: string; size?: number; gold?: boolean }) {
  const sp = speciesById(species);
  return (
    <svg width={size} height={size} viewBox="-2 -14 32 28" aria-hidden="true">
      <g transform="rotate(-18 14 0)">
        <path d={SLIP} fill={gold ? "var(--gold)" : sp.leaf} stroke={gold ? "var(--gold-deep)" : sp.edge} strokeWidth="1.6" />
        <path d={FOLD} fill="none" stroke="oklch(0.3 0.04 262 / 0.4)" strokeWidth="1.2" />
      </g>
    </svg>
  );
}
