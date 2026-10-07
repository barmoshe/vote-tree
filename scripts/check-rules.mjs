// Checks the game rules against a local `wrangler dev` started with VOTING_OPEN=1, through the real
// API with separate cookie jars. Local only. Clear the local `rate` table first (12 joins an hour).
// Usage: node scripts/check-rules.mjs [base]
const base = process.argv[2] ?? "http://localhost:8793";
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(base)) throw new Error("local only");

async function call(path, cookie, body, method) {
  const res = await fetch(base + path, {
    method: method ?? (body ? "POST" : "GET"),
    headers: { origin: base, "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get("set-cookie");
  return { status: res.status, json: await res.json().catch(() => ({})), cookie: set ? set.split(";")[0] : cookie };
}
const me = async (p) => (await call("/api/me", p.cookie)).json.me;
async function join(name, ref) {
  const r = await call("/api/join", null, { name, ref });
  if (!r.json.ok) throw new Error(name + ": " + JSON.stringify(r.json));
  const m = (await call("/api/me", r.cookie)).json.me;
  return { name, cookie: r.cookie, code: m.code };
}

let fails = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? "  " + detail : ""}`);
  if (!ok) fails++;
};

const R = await join("שורש בדיקה");
const kids = [];
for (const n of ["א", "ב", "ג"]) kids.push(await join("ילד " + n, R.code));
const grand = [];
for (const n of ["ד", "ה", "ו", "ז"]) grand.push(await join("נכד " + n, kids[0].code));

// watering: once a day
const w1 = await call("/api/water", R.cookie, {});
const w2 = await call("/api/water", R.cookie, {});
check("watering counts once a day", w1.json.streak === 1 && w2.json.already === true, JSON.stringify([w1.json, w2.json]));

await call("/api/plan", R.cookie, {});
// votes: R, kid A, kid B, grandchildren D, E
for (const p of [R, kids[0], kids[1], grand[0], grand[1], grand[2], grand[3]]) await call("/api/vote", p.cookie, {});

// witness stamps
const rMe = await me(R);
check("a voter gets a witness code", !!rMe.confirmCode);
check("no self-stamp", (await call(`/api/confirm/${rMe.confirmCode}`, R.cookie, {})).status === 400);
check("a friend can stamp", (await call(`/api/confirm/${rMe.confirmCode}`, kids[0].cookie, {})).status === 200);
check("a second stamp is refused", (await call(`/api/confirm/${rMe.confirmCode}`, kids[1].cookie, {})).status === 409);
// kid A has stamped 1; stamp 4 more, then the 6th is refused
const targets = [kids[1], grand[0], grand[1], grand[2], grand[3]];
const statuses = [];
for (const t of targets) {
  const c = (await me(t)).confirmCode;
  statuses.push((await call(`/api/confirm/${c}`, kids[0].cookie, {})).status);
}
check("a witness can stamp five, not six", statuses.slice(0, 4).every((s) => s === 200) && statuses[4] === 429, JSON.stringify(statuses));

// points: water 1 + plan 3 + vote 10 + stamp 10 + 3 direct joins + 2 direct votes x5 + 4 deeper votes x1
const after = await me(R);
const expected = 1 + 3 + 10 + 10 + 3 + 2 * 5 + 4;
check("points add up", after.points === expected, `got ${after.points}, expected ${expected}`);
check("stats", after.stats.totalJoined === 7 && after.stats.totalVoted === 6 && after.stats.confirmed && after.stats.streak === 1, JSON.stringify(after.stats));

// species lock: R is at level 2 (שתיל, 20+); almond (level 2) opens, oak (level 3) does not
check("species unlocked by level", (await call("/api/species", R.cookie, { species: "almond" })).status === 200);
check("species above the level is refused", (await call("/api/species", R.cookie, { species: "oak" })).status === 403);

// leagues
const L = await call("/api/leagues", R.cookie, { name: "ליגת בדיקה" });
check("create a league", !!L.json.code);
await call(`/api/leagues/${L.json.code}/join`, kids[2].cookie, {}); // kid C: no tree, no vote
await call(`/api/leagues/${L.json.code}/join`, grand[3].cookie, {});
const table = (await call(`/api/leagues/${L.json.code}`, R.cookie)).json;
check("league ranks members, including one with no tree", table.members.length === 3 && table.members[0].name === R.name && table.members.some((m) => m.name === kids[2].name), JSON.stringify(table.members.map((m) => [m.name, m.points])));
check("league marks me", table.isMember && table.isOwner && table.members[0].me === true);
check("leaving a league", (await call(`/api/leagues/${L.json.code}/leave`, grand[3].cookie, {})).status === 200 && (await call(`/api/leagues/${L.json.code}`, R.cookie)).json.members.length === 2);

// link previews name the sender
const page = await fetch(`${base}/c/${rMe.confirmCode}`).then((r) => r.text());
check("witness link preview names the voter", page.includes("חותמת עד ל־" + R.name));
const lpage = await fetch(`${base}/l/${L.json.code}`).then((r) => r.text());
check("league link preview names the league", lpage.includes("ליגת בדיקה"));

console.log(fails ? `\n${fails} failed` : "\nall rules hold");
process.exit(fails ? 1 : 0);
