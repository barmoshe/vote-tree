// Drops (the points), levels, species and achievements. Drops are symbolic only: no prizes, no value.

export const POINTS = {
  inviteJoined: 1, // someone you invited joined
  plan: 3, // you made a voting plan
  water: 1, // one watering a day before election day
  selfVoted: 10, // you voted
  confirmed: 10, // a friend stamped your vote as witnessed (a confirmed vote is worth 20)
  directVoted: 5, // someone you invited voted
  deeperVoted: 1, // someone further down your tree voted
} as const;

export const LEVELS = [
  { min: 0, name: "זרע", icon: "🌰" },
  { min: 5, name: "נבט", icon: "🌱" },
  { min: 20, name: "שתיל", icon: "🌿" },
  { min: 50, name: "עץ", icon: "🌳" },
  { min: 150, name: "חורשה", icon: "🏞️" },
  { min: 400, name: "יער", icon: "🌲" },
] as const;

export function level(points: number) {
  let i = 0;
  for (let k = 0; k < LEVELS.length; k++) if (points >= LEVELS[k].min) i = k;
  const next = LEVELS[i + 1];
  return {
    index: i,
    name: LEVELS[i].name,
    icon: LEVELS[i].icon,
    next: next ? { name: next.name, at: next.min } : null,
    progress: next ? (points - LEVELS[i].min) / (next.min - LEVELS[i].min) : 1,
  };
}

// Tree species: cosmetic, each unlocked at a level. Gold always means "voted", whatever the species.
export const SPECIES = [
  { id: "olive", name: "זית", level: 0, leaf: "oklch(0.72 0.07 140)", edge: "oklch(0.52 0.07 145)", shape: "slim" },
  { id: "fig", name: "תאנה", level: 1, leaf: "oklch(0.7 0.15 140)", edge: "oklch(0.5 0.13 145)", shape: "broad" },
  { id: "almond", name: "שקד", level: 2, leaf: "oklch(0.9 0.06 350)", edge: "oklch(0.7 0.11 350)", shape: "blossom" },
  { id: "oak", name: "אלון", level: 3, leaf: "oklch(0.58 0.12 150)", edge: "oklch(0.42 0.1 150)", shape: "broad" },
  { id: "pomegranate", name: "רימון", level: 4, leaf: "oklch(0.66 0.14 135)", edge: "oklch(0.55 0.19 25)", shape: "slim" },
  { id: "cedar", name: "ארז", level: 5, leaf: "oklch(0.5 0.09 175)", edge: "oklch(0.36 0.07 180)", shape: "needle" },
] as const;

export type SpeciesId = (typeof SPECIES)[number]["id"];
export const speciesById = (id: string) => SPECIES.find((s) => s.id === id) ?? SPECIES[0];

export type Stats = {
  voted: boolean;
  planned: boolean;
  confirmed: boolean; // a witness stamped your vote
  watered: number; // days watered in total
  streak: number; // current run of consecutive days
  leagues: number;
  directJoined: number;
  totalJoined: number;
  directVoted: number;
  totalVoted: number;
  depth: number; // generations below you
};

export function pointsOf(s: Pick<Stats, "voted" | "planned" | "confirmed" | "watered" | "directJoined" | "directVoted" | "totalVoted">) {
  return (
    (s.voted ? POINTS.selfVoted : 0) +
    (s.voted && s.confirmed ? POINTS.confirmed : 0) +
    (s.planned ? POINTS.plan : 0) +
    s.watered * POINTS.water +
    s.directJoined * POINTS.inviteJoined +
    s.directVoted * POINTS.directVoted +
    (s.totalVoted - s.directVoted) * POINTS.deeperVoted
  );
}

export const ACHIEVEMENTS: { id: string; icon: string; title: string; hint: string; done: (s: Stats) => boolean }[] = [
  { id: "seed", icon: "🌰", title: "זרע ראשון", hint: "הצטרפות לעץ", done: () => true },
  { id: "plan", icon: "🗺️", title: "יש תוכנית", hint: "תוכנית הצבעה: מתי, איך ועם מי", done: (s) => s.planned },
  { id: "water3", icon: "💧", title: "שלושה ימי השקיה", hint: "השקיה שלושה ימים ברצף", done: (s) => s.streak >= 3 },
  { id: "water7", icon: "🔥", title: "שבוע של השקיה", hint: "השקיה שבעה ימים ברצף", done: (s) => s.streak >= 7 },
  { id: "league", icon: "🏟️", title: "בליגה", hint: "הצטרפות לליגה פרטית", done: (s) => s.leagues >= 1 },
  { id: "first", icon: "🌱", title: "ענף ראשון", hint: "מישהו הצטרף דרך הקישור שלך", done: (s) => s.directJoined >= 1 },
  { id: "five", icon: "🖐️", title: "חמישה ענפים", hint: "5 הצטרפו ישירות דרכך", done: (s) => s.directJoined >= 5 },
  { id: "gen3", icon: "🧬", title: "דור שלישי", hint: "מישהו שהזמנת הזמין מישהו שהזמין עוד מישהו", done: (s) => s.depth >= 3 },
  { id: "grove", icon: "🏞️", title: "חורשה", hint: "25 אנשים בעץ שלך", done: (s) => s.totalJoined >= 25 },
  { id: "voted", icon: "🗳️", title: "הצבעתי", hint: "סימון הצבעה ביום הבחירות", done: (s) => s.voted },
  { id: "witness", icon: "🔏", title: "חותמת עד", hint: "חבר אישר שהצבעת", done: (s) => s.confirmed },
  { id: "ten", icon: "✨", title: "עשרה עלי זהב", hint: "10 הצביעו בעץ שלך", done: (s) => s.totalVoted >= 10 },
  { id: "forest", icon: "🌲", title: "יער זהב", hint: "100 הצביעו בעץ שלך", done: (s) => s.totalVoted >= 100 },
];
