import type { Phase } from "./election";
import type { Stats } from "./game";

// One node of the tree as the page sees it. Only people you invited yourself carry a name;
// further down the tree everyone is an anonymous leaf.
export type TreeNode = { i: number; p: number | null; v: boolean; n?: string };

export type Me = {
  name: string;
  code: string;
  key: string; // the personal link back in (/restore#key)
  inviter: string | null;
  stats: Stats;
  points: number;
  tree: TreeNode[];
  treeTruncated: boolean;
};

export type MeResponse = { me: Me | null; phase: Phase; daysUntil: number };

export type Leader = { name: string; points: number; joined: number; voted: number };
