import type { Leader, MeResponse } from "../shared/api";

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
  restore: (key: string) => post("/api/restore", { key }),
  logout: () => post("/api/logout"),
  leave: () => post("/api/leave"),
};

const ERRORS: Record<string, string> = {
  name: "השם צריך להיות בין 2 ל־24 תווים, בלי קישורים.",
  rate: "יותר מדי הצטרפויות מהרשת הזאת בשעה האחרונה. אפשר לנסות שוב מאוחר יותר.",
  closed: "אפשר לסמן הצבעה רק ביום הבחירות.",
  key: "הקישור הזה לא עובד. אולי הוא הועתק חלקית?",
};

export function errorText(e: unknown) {
  const code = e instanceof Error ? e.message : "";
  return ERRORS[code] ?? "משהו השתבש. אפשר לנסות שוב.";
}
