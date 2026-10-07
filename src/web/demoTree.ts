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
