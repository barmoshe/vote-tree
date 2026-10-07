// Election day 27.10.2026 (Tuesday). Israel is back on winter time (UTC+2) from 25.10.
// Polls are open 07:00-22:00; a vote can be marked until 23:59 the same night.
export const ELECTION_DATE_LABEL = "27.10.2026";
export const POLLS_OPEN = Date.parse("2026-10-27T05:00:00Z");
export const POLLS_CLOSE = Date.parse("2026-10-27T20:00:00Z");
export const MARKING_CLOSES = Date.parse("2026-10-27T21:59:59Z");

export type Phase = "before" | "open" | "after";

// `forceOpen` lets a test deployment open marking early (the VOTING_OPEN var).
export function phase(now = Date.now(), forceOpen = false): Phase {
  if (forceOpen) return "open";
  if (now < POLLS_OPEN) return "before";
  if (now <= MARKING_CLOSES) return "open";
  return "after";
}

export function daysUntil(now = Date.now()): number {
  return Math.max(0, Math.ceil((POLLS_OPEN - now) / 86_400_000));
}

// The calendar date in Israel ("2026-10-27"), for once-a-day watering.
export function israelDate(now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(now));
}
