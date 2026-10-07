import type { TreeNode } from "../shared/api";

// A made-up tree for the demo and the home page: deterministic, so every visit sees the same one.

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ["נועה", "איתי", "מאיה", "יוסי", "רותם", "דנה", "עומר", "שירה", "אבי", "ליאור", "תמר", "גל"];

export type DemoNode = TreeNode & { t: number | null }; // t = vote time in hours (7-22), null = didn't vote

export function demoTree(seed = 27, maxNodes = 120, maxDepth = 5, directKids = 6): DemoNode[] {
  const r = rng(seed);
  const nodes: DemoNode[] = [{ i: 0, p: null, v: false, n: "אני", t: 8.2 }];
  const queue: { i: number; d: number }[] = [{ i: 0, d: 0 }];
  while (queue.length && nodes.length < maxNodes) {
    const { i, d } = queue.shift()!;
    if (d >= maxDepth) continue;
    const kids = d === 0 ? directKids : d === 1 ? 2 + Math.floor(r() * 4) : d === 2 ? 1 + Math.floor(r() * 3) : Math.floor(r() * 3);
    for (let k = 0; k < kids && nodes.length < maxNodes; k++) {
      const id = nodes.length;
      // Most people vote; the times bunch in the morning and after work.
      const votes = r() < 0.8;
      const t = votes ? (r() < 0.45 ? 7.2 + r() * 3.3 : r() < 0.4 ? 11 + r() * 5 : 17 + r() * 4.8) : null;
      nodes.push({ i: id, p: i, v: false, t, ...(d === 0 ? { n: NAMES[k % NAMES.length] } : {}) });
      queue.push({ i: id, d: d + 1 });
    }
  }
  return nodes;
}

// The demo's story: who joined when over the three weeks before the election, with a name for
// everyone (made up) so the caption feed can tell it.
const FIRST = ["נועה", "איתי", "מאיה", "יוסי", "רותם", "דנה", "עומר", "שירה", "אבי", "ליאור", "תמר", "גל", "יעל", "אורי", "הדר", "רועי", "ענבל", "אלון", "מיכל", "עידו", "שקד", "נדב", "רוני", "טל", "אסף", "ליה", "גיא", "עדי", "אריאל", "נגה"];

export type StoryNode = DemoNode & { name: string; day: number };

export const STORY_DAYS = 20;

export function demoStory(seed = 27): StoryNode[] {
  const nodes = demoTree(seed, 120, 5, 6);
  const r = rng(seed * 7 + 1);
  const out: StoryNode[] = [];
  for (const n of nodes) {
    const i = n.i;
    const parentDay = n.p == null ? 0 : out[n.p].day;
    // Joins bunch up over time, the way word of mouth spreads; never before the inviter.
    const base = STORY_DAYS * Math.pow(i / nodes.length, 0.8);
    const day = n.p == null ? 0 : Math.min(STORY_DAYS - 0.2, Math.max(parentDay + 0.3 + r() * 0.6, base + (r() - 0.5) * 1.5));
    out.push({ ...n, name: i === 0 ? "אני" : FIRST[(i * 7 + Math.floor(r() * 3)) % FIRST.length], day });
  }
  return out;
}
