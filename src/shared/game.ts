// Drops (the points), levels, species and achievements. Drops are symbolic only: no prizes, no value.

export const POINTS = {
  inviteJoined: 1, // someone you invited joined
  plan: 3, // you made a voting plan
  water: 1, // one watering a day before election day
  selfVoted: 1, // you tapped "I voted": a claim alone is worth little
  confirmed: 10, // a friend stamped your vote as witnessed
  photo: 10, // a photo from outside the polling station, unflagged by your league-mates
  directVoted: 5, // someone you invited voted
  deeperVoted: 1, // someone further down your tree voted
} as const;

export const LEVELS = [
  { min: 0, name: "עציץ", icon: "pot" },
  { min: 5, name: "נבט", icon: "sprout" },
  { min: 20, name: "שתיל", icon: "sapling" },
  { min: 50, name: "עץ", icon: "tree" },
  { min: 150, name: "חורשה", icon: "grove" },
  { min: 400, name: "יער", icon: "forest" },
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
  { id: "olive", name: "זית", level: 0, leaf: "#9AA77A", edge: "#5E6B45" },
  { id: "fig", name: "תאנה", level: 1, leaf: "#6F9A4F", edge: "#3F6B2E" },
  { id: "almond", name: "שקד", level: 2, leaf: "#F7E3E8", edge: "#C98A9B" },
  { id: "oak", name: "אלון", level: 3, leaf: "#5E8A4B", edge: "#33562A" },
  { id: "pomegranate", name: "רימון", level: 4, leaf: "#82A85C", edge: "#4A6B32" },
  { id: "cedar", name: "ארז", level: 5, leaf: "#3F6E5A", edge: "#244538" },
] as const;

export type SpeciesId = (typeof SPECIES)[number]["id"];
export const speciesById = (id: string) => SPECIES.find((s) => s.id === id) ?? SPECIES[0];

export type Stats = {
  voted: boolean;
  planned: boolean;
  confirmed: boolean; // a witness stamped your vote
  photo: boolean; // a photo from the polling station, not hidden by flags
  watered: number; // days watered in total
  streak: number; // current run of consecutive days
  leagues: number;
  directJoined: number;
  totalJoined: number;
  directVoted: number;
  totalVoted: number;
  depth: number; // generations below you
};

export function pointsOf(s: Pick<Stats, "voted" | "planned" | "confirmed" | "photo" | "watered" | "directJoined" | "directVoted" | "totalVoted">) {
  return (
    (s.voted ? POINTS.selfVoted : 0) +
    (s.voted && s.confirmed ? POINTS.confirmed : 0) +
    (s.voted && s.photo ? POINTS.photo : 0) +
    (s.planned ? POINTS.plan : 0) +
    s.watered * POINTS.water +
    s.directJoined * POINTS.inviteJoined +
    s.directVoted * POINTS.directVoted +
    (s.totalVoted - s.directVoted) * POINTS.deeperVoted
  );
}

export const ACHIEVEMENTS: { id: string; icon: string; title: string; hint: string; done: (s: Stats) => boolean }[] = [
  { id: "planted", icon: "pot", title: "שתילה ראשונה", hint: "הצטרפות לעץ", done: () => true },
  { id: "plan", icon: "map", title: "יש תוכנית", hint: "תוכנית הצבעה: מתי, איך ועם מי", done: (s) => s.planned },
  { id: "water3", icon: "drop", title: "שלושה ימי השקיה", hint: "השקיה שלושה ימים ברצף", done: (s) => s.streak >= 3 },
  { id: "water7", icon: "flame", title: "שבוע של השקיה", hint: "השקיה שבעה ימים ברצף", done: (s) => s.streak >= 7 },
  { id: "league", icon: "league", title: "בליגה", hint: "הצטרפות לליגה פרטית", done: (s) => s.leagues >= 1 },
  { id: "first", icon: "sprout", title: "ענף ראשון", hint: "מישהו הצטרף דרך הקישור שלך", done: (s) => s.directJoined >= 1 },
  { id: "five", icon: "hand", title: "חמישה ענפים", hint: "5 הצטרפו ישירות דרכך", done: (s) => s.directJoined >= 5 },
  { id: "gen3", icon: "generations", title: "דור שלישי", hint: "מישהו שהזמנת הזמין מישהו שהזמין עוד מישהו", done: (s) => s.depth >= 3 },
  { id: "grove", icon: "grove", title: "חורשה", hint: "25 אנשים בעץ שלך", done: (s) => s.totalJoined >= 25 },
  { id: "voted", icon: "ballot", title: "הצבעתי", hint: "סימון הצבעה ביום הבחירות", done: (s) => s.voted },
  { id: "witness", icon: "stamp", title: "חותמת עד", hint: "חבר אישר שהצבעת", done: (s) => s.confirmed },
  { id: "photo", icon: "camera", title: "תמונה מהקלפי", hint: "תמונה מבחוץ, בלי הפתק ובלי הפרגוד", done: (s) => s.photo },
  { id: "ten", icon: "sparkle", title: "עשרה עלי זהב", hint: "10 הצביעו בעץ שלך", done: (s) => s.totalVoted >= 10 },
  { id: "forest", icon: "forest", title: "יער זהב", hint: "100 הצביעו בעץ שלך", done: (s) => s.totalVoted >= 100 },
];
