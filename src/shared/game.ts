// Points, levels and achievements. Points are symbolic only: no prizes, no value.

export const POINTS = {
  inviteJoined: 1, // someone you invited joined
  selfVoted: 10, // you voted
  directVoted: 5, // someone you invited voted
  deeperVoted: 1, // someone further down your tree voted
} as const;

export const LEVELS = [
  { min: 0, name: "זרע" },
  { min: 5, name: "נבט" },
  { min: 20, name: "שתיל" },
  { min: 50, name: "עץ" },
  { min: 150, name: "חורשה" },
  { min: 400, name: "יער" },
] as const;

export function level(points: number) {
  let i = 0;
  for (let k = 0; k < LEVELS.length; k++) if (points >= LEVELS[k].min) i = k;
  const next = LEVELS[i + 1];
  return {
    index: i,
    name: LEVELS[i].name,
    next: next ? { name: next.name, at: next.min } : null,
    progress: next ? (points - LEVELS[i].min) / (next.min - LEVELS[i].min) : 1,
  };
}

export type Stats = {
  voted: boolean;
  directJoined: number;
  totalJoined: number;
  directVoted: number;
  totalVoted: number;
  depth: number; // generations below you, as far as the tree view sees
};

export const ACHIEVEMENTS: { id: string; title: string; hint: string; done: (s: Stats) => boolean }[] = [
  { id: "seed", title: "זרע ראשון", hint: "הצטרפות לעץ", done: () => true },
  { id: "first", title: "ענף ראשון", hint: "מישהו הצטרף דרך הקישור שלך", done: (s) => s.directJoined >= 1 },
  { id: "five", title: "חמישה ענפים", hint: "5 הצטרפו ישירות דרכך", done: (s) => s.directJoined >= 5 },
  { id: "gen3", title: "דור שלישי", hint: "מישהו שהזמנת הזמין מישהו שהזמין עוד מישהו", done: (s) => s.depth >= 3 },
  { id: "grove", title: "חורשה", hint: "25 אנשים בעץ שלך", done: (s) => s.totalJoined >= 25 },
  { id: "voted", title: "הצבעתי", hint: "סימון הצבעה ביום הבחירות", done: (s) => s.voted },
  { id: "ten", title: "עשרה קולות", hint: "10 הצביעו בעץ שלך", done: (s) => s.totalVoted >= 10 },
  { id: "forest", title: "יער", hint: "100 הצביעו בעץ שלך", done: (s) => s.totalVoted >= 100 },
];
