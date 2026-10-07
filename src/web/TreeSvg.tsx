import { useId, useMemo } from "react";
import { stratify, tree as d3tree } from "d3-hierarchy";
import type { TreeNode } from "../shared/api";

// Draws the tree as a real tree: the trunk at the bottom, every generation one ring further up
// a half-crown. Leaves are people; green = joined, gold = voted.

const W = 800;
const H = 540;
const CX = W / 2;
const CY = H - 92;
const MAX_R = CY - 46;
const SPAN_FROM = Math.PI * 1.1;
const SPAN_TO = Math.PI * 1.9;

type Placed = { i: number; x: number; y: number; a: number; r: number; depth: number; v: boolean; n?: string; parent?: Placed };

function polar(a: number, r: number): [number, number] {
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

export function layout(nodes: TreeNode[]) {
  if (nodes.length === 0) return { placed: [] as Placed[], maxDepth: 0 };
  const root = stratify<TreeNode>()
    .id((d) => String(d.i))
    .parentId((d) => (d.p == null ? null : String(d.p)))(nodes);
  const maxDepth = Math.max(1, root.height);
  const ring = MAX_R / Math.max(maxDepth, 2.2);
  d3tree<TreeNode>()
    .size([SPAN_TO - SPAN_FROM, 1])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.6) / Math.max(1, a.depth))(root);

  const placed: Placed[] = [];
  const byId = new Map<string, Placed>();
  root.each((d) => {
    const a = SPAN_FROM + (d.x ?? 0);
    const r = d.depth * ring;
    const [x, y] = polar(a, r);
    const p: Placed = {
      i: d.data.i,
      x,
      y,
      a,
      r,
      depth: d.depth,
      v: d.data.v,
      n: d.data.n,
      parent: d.parent ? byId.get(d.parent.id!) : undefined,
    };
    byId.set(d.id!, p);
    placed.push(p);
  });
  return { placed, maxDepth };
}

function branch(p: Placed) {
  const par = p.parent!;
  const mid = (par.r + p.r) / 2;
  const [x1, y1] = par.depth === 0 ? [CX, CY - p.r * 0.5] : polar(par.a, mid);
  const [x2, y2] = polar(p.a, mid);
  return `M${par.x.toFixed(1)},${par.y.toFixed(1)} C${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
}

type Props = {
  nodes: TreeNode[];
  label: string;
  /** For the demo: decides "voted" per node at the current simulated time. */
  votedAt?: (i: number) => boolean;
  showNames?: boolean;
  animate?: boolean;
};

export function TreeSvg({ nodes, label, votedAt, showNames = true, animate = true }: Props) {
  const gid = useId().replace(/:/g, "");
  const { placed } = useMemo(() => layout(nodes), [nodes]);
  const voted = (p: Placed) => (votedAt ? votedAt(p.i) : p.v);
  const direct = placed.filter((p) => p.depth === 1);
  const names = showNames && direct.length <= 14;
  const n = placed.length;
  const leafScale = n > 160 ? 0.8 : n > 80 ? 1 : n > 40 ? 1.3 : 1.7;

  return (
    <svg className={"tree" + (animate ? " tree-anim" : "")} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <defs>
        <radialGradient id={`sky${gid}`}>
          <stop offset="0" stopColor="var(--sky)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--sky)" stopOpacity="0" />
        </radialGradient>
        <filter id={`glow${gid}`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <path id={`leaf${gid}`} d="M0,0 C5,-7 15,-7 21,0 C15,7 5,7 0,0Z" />
      </defs>

      <ellipse cx={CX} cy={CY - MAX_R * 0.45} rx={MAX_R * 1.05} ry={MAX_R * 0.78} fill={`url(#sky${gid})`} />
      <path d={`M${CX - 160},${H - 26} Q${CX},${H - 54} ${CX + 160},${H - 26}`} fill="none" stroke="var(--border)" strokeWidth="2" />

      {/* trunk */}
      <path
        d={`M${CX - 20},${H - 30} C${CX - 10},${CY + 34} ${CX - 8},${CY + 12} ${CX - 5},${CY} L${CX + 5},${CY} C${CX + 8},${CY + 12} ${CX + 10},${CY + 34} ${CX + 20},${H - 30} Z`}
        fill="var(--bark)"
      />

      <g fill="none" stroke="var(--bark)" strokeLinecap="round">
        {placed
          .filter((p) => p.parent)
          .map((p, k) => (
            <path
              key={p.i}
              d={branch(p)}
              strokeWidth={Math.max(1.6, 10 - p.depth * 2.2)}
              className="branch"
              style={{ animationDelay: `${Math.min(k * 12, 900)}ms` }}
            />
          ))}
      </g>

      <g>
        {placed
          .filter((p) => p.depth > 0)
          .map((p, k) => {
            const on = voted(p);
            const deg = (p.a * 180) / Math.PI;
            return (
              <g
                key={p.i}
                transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`}
                className={"leaf" + (on ? " leaf-on" : "")}
                style={{ animationDelay: `${200 + Math.min(k * 14, 1100)}ms` }}
              >
                <g transform={`rotate(${deg.toFixed(1)}) scale(${(p.depth === 1 ? 1.15 : 1) * leafScale})`}>
                  <use
                    href={`#leaf${gid}`}
                    fill={on ? "var(--gold)" : "var(--leaf)"}
                    stroke={on ? "var(--gold-deep)" : "var(--leaf-deep)"}
                    strokeWidth="1.2"
                    filter={on ? `url(#glow${gid})` : undefined}
                  />
                </g>
              </g>
            );
          })}
      </g>

      {names &&
        direct.map((p) => {
          const [lx, ly] = polar(p.a, p.r + 26 + 16 * leafScale);
          return (
            <text key={`n${p.i}`} x={lx} y={ly} className="tree-name" textAnchor="middle" dominantBaseline="middle">
              {p.n}
            </text>
          );
        })}

      {/* you, at the root */}
      <g transform={`translate(${CX},${CY})`}>
        <circle r="25" fill={placed[0] && voted(placed[0]) ? "var(--gold)" : "var(--primary)"} stroke="var(--surface)" strokeWidth="3" />
        <text className="tree-me" textAnchor="middle" dominantBaseline="central">
          אני
        </text>
      </g>
    </svg>
  );
}
