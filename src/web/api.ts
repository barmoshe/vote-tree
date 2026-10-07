import type { League, Leader, MeResponse, Pulse, Witness } from "../shared/api";

async function post(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? String(res.status));
  return data;
}

export const api = {
  me: () => fetch("/api/me").then((r) => r.json() as Promise<MeResponse>),
  invite: async (code: string) => {
    const r = await fetch(`/api/invite/${encodeURIComponent(code)}`);
    return r.ok ? ((await r.json()) as { name: string }) : null;
  },
  leaders: () => fetch("/api/leaders").then((r) => r.json() as Promise<{ leaders: Leader[] }>),
  join: (name: string, ref?: string) => post("/api/join", { name, ref }),
  vote: () => post("/api/vote"),
  plan: () => post("/api/plan"),
  water: () => post("/api/water") as Promise<{ ok: boolean; already?: boolean; streak?: number }>,
  witness: async (code: string) => {
    const r = await fetch(`/api/confirm/${encodeURIComponent(code)}`);
    return r.ok ? ((await r.json()) as Witness) : null;
  },
  confirm: (code: string) => post(`/api/confirm/${encodeURIComponent(code)}`),
  league: async (code: string) => {
    const r = await fetch(`/api/leagues/${encodeURIComponent(code)}`);
    return r.ok ? ((await r.json()) as League) : null;
  },
  uploadPhoto: async (blob: Blob) => {
    const res = await fetch("/api/photo", { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error ?? String(res.status));
  },
  deletePhoto: () => post("/api/photo/delete"),
  flagPhoto: (token: string) => post(`/api/photo/${encodeURIComponent(token)}/flag`),
  photoUrl: (token: string) => `/api/photo/${encodeURIComponent(token)}`,
  createLeague: (name: string) => post("/api/leagues", { name }) as Promise<{ code?: string }>,
  joinLeague: (code: string) => post(`/api/leagues/${encodeURIComponent(code)}/join`),
  leaveLeague: (code: string) => post(`/api/leagues/${encodeURIComponent(code)}/leave`),
  species: (species: string) => post("/api/species", { species }),
  pulse: () => fetch("/api/pulse").then((r) => r.json() as Promise<Pulse>),
  restore: (key: string) => post("/api/restore", { key }),
  logout: () => post("/api/logout"),
  leave: () => post("/api/leave"),
};

const ERRORS: Record<string, string> = {
  name: "השם צריך להיות בין 2 ל־24 תווים, בלי קישורים.",
  rate: "יותר מדי הצטרפויות מהרשת הזאת בשעה האחרונה. אפשר לנסות שוב מאוחר יותר.",
  closed: "אפשר לסמן הצבעה רק ביום הבחירות.",
  key: "הקישור הזה לא עובד. אולי הוא הועתק חלקית?",
  locked: "העץ הזה נפתח בדרגה גבוהה יותר.",
  self: "אי אפשר להחתים את עצמך. החותמת באה מחבר.",
  stamped: "הפתק הזה כבר קיבל חותמת עד.",
  stamps: "כבר החתמת חמישה אנשים. זה המקסימום.",
  leagues: "הגעת למספר הליגות המקסימלי.",
  not_found: "לא מצאנו את זה. אולי הקישור הועתק חלקית?",
  auth: "צריך עץ כדי לעשות את זה.",
  vote_first: "קודם מסמנים שהצבעת.",
  photo_size: "התמונה גדולה מדי. אפשר לנסות תמונה אחרת.",
  photo_type: "אפשר להעלות רק תמונה.",
  photo_hidden: "חברי הליגה סימנו את התמונה הקודמת, אז אי אפשר להחליף אותה.",
};

export function errorText(e: unknown) {
  const code = e instanceof Error ? e.message : "";
  return ERRORS[code] ?? "משהו השתבש. אפשר לנסות שוב.";
}
