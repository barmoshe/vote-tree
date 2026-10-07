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
  species: string;
  confirmCode: string | null; // the witness link, once you voted
  confirmedBy: string | null; // who stamped your vote
  wateredToday: boolean;
  leagues: { code: string; name: string; members: number }[];
  stats: Stats;
  points: number;
  tree: TreeNode[];
  treeTruncated: boolean;
};

export type MeResponse = { me: Me | null; phase: Phase; daysUntil: number };

export type Leader = { name: string; points: number; joined: number; voted: number; species: string; me?: boolean };

export type League = { code: string; name: string; owner: string; isMember: boolean; isOwner: boolean; members: Leader[] };

export type Witness = { name: string; voted: boolean; confirmedBy: string | null; self: boolean };

export type Pulse = { people: number; voted: number; trees: number };
