import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { daysUntil, israelDate, phase } from "../shared/election";
import { SPECIES, level, pointsOf } from "../shared/game";
import type { Leader, League, Me, MeResponse, Pulse, TreeNode, Witness } from "../shared/api";

type Env = { DB: D1Database; ASSETS: Fetcher; VOTING_OPEN?: string };
type User = {
  id: string;
  name: string;
  code: string;
  parent_id: string | null;
  key_hash: string;
  created_at: number;
  voted_at: number | null;
  plan_at: number | null;
  species: string;
  confirm_code: string | null;
  confirmed_by: string | null;
  confirmed_at: number | null;
  water_day: string | null;
  water_streak: number;
  water_total: number;
};
type C = Context<{ Bindings: Env }>;

const COOKIE = "vt";
const YEAR = 60 * 60 * 24 * 365;
const TREE_DEPTH = 5;
const TREE_LIMIT = 400;
const JOINS_PER_HOUR = 12;
const STAMPS_PER_WITNESS = 5;
const LEAGUES_OWNED = 10;
const LEAGUES_JOINED = 20;
const LEAGUE_TABLE = 200;

const app = new Hono<{ Bindings: Env }>();

// ---------- helpers ----------

const enc = new TextEncoder();

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomKey(bytes = 24) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Short codes from an alphabet with no look-alikes (no 0/O, 1/l/I).
const ALPHA = "23456789abcdefghjkmnpqrstuvwxyz";
function newCode(len = 6) {
  const a = crypto.getRandomValues(new Uint8Array(len));
  return [...a].map((b) => ALPHA[b % ALPHA.length]).join("");
}

function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

function cleanName(raw: unknown, max = 24): string | null {
  if (typeof raw !== "string") return null;
  const s = raw
    .replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length < 2 || s.length > max) return null;
  if (/https?:|www\.|\.com|@/i.test(s)) return null;
  return s;
}

const isOpen = (env: Env) => phase(Date.now(), env.VOTING_OPEN === "1");
const param = (c: C, k: string) => (c.req.param(k) ?? "").toLowerCase();

async function currentUser(c: C) {
  const raw = getCookie(c, COOKIE);
  return raw ? userFromKey(c.env.DB, raw) : null;
}

async function userFromKey(db: D1Database, raw: string): Promise<User | null> {
  const dot = raw.indexOf(".");
  if (dot < 1) return null;
  const id = raw.slice(0, dot);
  const user = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<User>();
  if (!user || !user.key_hash) return null;
  return equal(await sha256(raw.slice(dot + 1)), user.key_hash) ? user : null;
}

function setSession(c: C, value: string) {
  setCookie(c, COOKIE, value, { path: "/", httpOnly: true, secure: true, sameSite: "Lax", maxAge: YEAR });
}

async function body<T>(c: C): Promise<Partial<T>> {
  return c.req.json<Partial<T>>().catch(() => ({}));
}

async function limited(db: D1Database, key: string, max: number, windowMs: number) {
  const now = Date.now();
  const row = await db
    .prepare(
      `INSERT INTO rate (key, count, reset_at) VALUES (?1, 1, ?2)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate.reset_at < ?3 THEN 1 ELSE rate.count + 1 END,
         reset_at = CASE WHEN rate.reset_at < ?3 THEN ?2 ELSE rate.reset_at END
       RETURNING count`,
    )
    .bind(key, now + windowMs, now)
    .first<{ count: number }>();
  return (row?.count ?? 0) > max;
}

type Agg = { dj: number; tj: number; dv: number; tv: number; depth: number };
type Scored = Agg & Pick<User, "voted_at" | "plan_at" | "confirmed_by" | "water_total">;

const points = (r: Scored) =>
  pointsOf({
    voted: r.voted_at != null,
    planned: r.plan_at != null,
    confirmed: r.confirmed_by != null,
    watered: r.water_total,
    directJoined: r.dj,
    directVoted: r.dv,
    totalVoted: r.tv,
  });

const AGG_SQL = `SELECT COALESCE(SUM(a.dist = 1), 0) AS dj, COUNT(*) AS tj,
         COALESCE(SUM(a.dist = 1 AND d.voted_at IS NOT NULL), 0) AS dv,
         COALESCE(SUM(d.voted_at IS NOT NULL), 0) AS tv,
         COALESCE(MAX(a.dist), 0) AS depth
  FROM ancestry a JOIN users d ON d.id = a.descendant_id
  WHERE a.ancestor_id = ?`;

const EMPTY: Agg = { dj: 0, tj: 0, dv: 0, tv: 0, depth: 0 };

async function aggregate(db: D1Database, id: string): Promise<Agg> {
  return (await db.prepare(AGG_SQL).bind(id).first<Agg>()) ?? EMPTY;
}

// One ranking for the national league and every private league. LEFT JOINs keep people who have
// not invited anyone yet: they still score their own vote, plan, stamp and watering.
async function ranked(db: D1Database, where: string, binds: unknown[], meId?: string): Promise<Leader[]> {
  const { results } = await db
    .prepare(
      `SELECT u.id, u.name, u.species, u.voted_at, u.plan_at, u.confirmed_by, u.water_total,
              COALESCE(SUM(a.dist = 1), 0) AS dj, COUNT(d.id) AS tj,
              COALESCE(SUM(a.dist = 1 AND d.voted_at IS NOT NULL), 0) AS dv,
              COALESCE(SUM(d.voted_at IS NOT NULL), 0) AS tv, 0 AS depth
       FROM users u
       LEFT JOIN ancestry a ON a.ancestor_id = u.id
       LEFT JOIN users d ON d.id = a.descendant_id
       WHERE u.key_hash != '' AND ${where}
       GROUP BY u.id`,
    )
    .bind(...binds)
    .all<Scored & { id: string; name: string; species: string }>();
  return results
    .map((r) => ({ name: r.name, species: r.species, points: points(r), joined: r.tj, voted: r.tv, ...(meId && r.id === meId ? { me: true } : {}) }))
    .sort((x, y) => y.points - x.points || y.voted - x.voted || y.joined - x.joined);
}

async function loadMe(db: D1Database, user: User, key: string): Promise<Me> {
  const [agg, rows, inviter, leagues, stamper] = await db.batch([
    db.prepare(AGG_SQL).bind(user.id),
    db
      .prepare(
        `SELECT d.id, d.parent_id, d.name, d.voted_at, a.dist
         FROM ancestry a JOIN users d ON d.id = a.descendant_id
         WHERE a.ancestor_id = ? AND a.dist <= ?
         ORDER BY a.dist, d.created_at
         LIMIT ?`,
      )
      .bind(user.id, TREE_DEPTH, TREE_LIMIT + 1),
    db.prepare("SELECT name FROM users WHERE id = ?").bind(user.parent_id ?? ""),
    db
      .prepare(
        `SELECT l.code, l.name, (SELECT COUNT(*) FROM league_members m2 WHERE m2.league_id = l.id) AS members
         FROM league_members m JOIN leagues l ON l.id = m.league_id
         WHERE m.user_id = ? ORDER BY m.joined_at`,
      )
      .bind(user.id),
    db.prepare("SELECT name FROM users WHERE id = ?").bind(user.confirmed_by ?? ""),
  ]);
  const a = (agg.results[0] as Agg | undefined) ?? EMPTY;
  const list = rows.results as { id: string; parent_id: string; name: string; voted_at: number | null; dist: number }[];

  // Map ids to small indices; the page never sees anyone's id.
  const index = new Map<string, number>([[user.id, 0]]);
  const tree: TreeNode[] = [{ i: 0, p: null, v: user.voted_at != null, n: user.name }];
  for (const r of list.slice(0, TREE_LIMIT)) {
    const p = index.get(r.parent_id);
    if (p === undefined) continue;
    const i = tree.length;
    index.set(r.id, i);
    tree.push({ i, p, v: r.voted_at != null, ...(r.dist === 1 ? { n: r.name } : {}) });
  }

  // A streak survives only if the last watering was today or yesterday.
  const today = israelDate();
  const yesterday = israelDate(Date.now() - 86_400_000);
  const streak = user.water_day === today || user.water_day === yesterday ? user.water_streak : 0;
  const myLeagues = leagues.results as { code: string; name: string; members: number }[];

  return {
    name: user.name,
    code: user.code,
    key,
    inviter: (inviter.results[0] as { name: string } | undefined)?.name ?? null,
    species: user.species,
    confirmCode: user.voted_at != null ? user.confirm_code : null,
    confirmedBy: (stamper.results[0] as { name: string } | undefined)?.name ?? null,
    wateredToday: user.water_day === today,
    leagues: myLeagues,
    stats: {
      voted: user.voted_at != null,
      planned: user.plan_at != null,
      confirmed: user.confirmed_by != null,
      watered: user.water_total,
      streak,
      leagues: myLeagues.length,
      directJoined: a.dj,
      totalJoined: a.tj,
      directVoted: a.dv,
      totalVoted: a.tv,
      depth: a.depth,
    },
    points: points({ ...a, ...user }),
    tree,
    treeTruncated: list.length > TREE_LIMIT,
  };
}

// ---------- API ----------

// Writes only from our own pages: the Origin must match the host.
app.use("/api/*", async (c, next) => {
  if (c.req.method !== "GET") {
    const origin = c.req.header("origin");
    if (!origin || new URL(origin).host !== new URL(c.req.url).host) return c.json({ error: "origin" }, 403);
  }
  await next();
  if (!c.res.headers.has("Cache-Control")) c.header("Cache-Control", "no-store");
});

app.get("/api/me", async (c) => {
  const raw = getCookie(c, COOKIE);
  const user = raw ? await userFromKey(c.env.DB, raw) : null;
  const res: MeResponse = {
    me: user && raw ? await loadMe(c.env.DB, user, raw) : null,
    phase: isOpen(c.env),
    daysUntil: daysUntil(),
  };
  return c.json(res);
});

app.get("/api/invite/:code", async (c) => {
  const row = await c.env.DB.prepare("SELECT name FROM users WHERE code = ? AND key_hash != ''").bind(param(c, "code")).first<{ name: string }>();
  return row ? c.json({ name: row.name }) : c.json({ error: "not_found" }, 404);
});

app.post("/api/join", async (c) => {
  const db = c.env.DB;
  if (await currentUser(c)) return c.json({ ok: true, already: true });

  const b = await body<{ name: unknown; ref: unknown }>(c);
  const name = cleanName(b.name);
  if (!name) return c.json({ error: "name" }, 400);

  const ip = c.req.header("cf-connecting-ip") ?? "local";
  if (await limited(db, "join:" + (await sha256(ip)).slice(0, 16), JOINS_PER_HOUR, 3_600_000)) {
    return c.json({ error: "rate" }, 429);
  }

  let parent: { id: string } | null = null;
  if (typeof b.ref === "string" && b.ref) {
    parent = await db.prepare("SELECT id FROM users WHERE code = ?").bind(b.ref.toLowerCase()).first<{ id: string }>();
  }

  const id = crypto.randomUUID();
  const secret = randomKey();
  const hash = await sha256(secret);
  const now = Date.now();

  for (let attempt = 0; attempt < 4; attempt++) {
    const stmts = [
      db.prepare("INSERT INTO users (id, name, code, parent_id, key_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, name, newCode(), parent?.id ?? null, hash, now),
    ];
    if (parent) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO ancestry (ancestor_id, descendant_id, dist)
             SELECT ancestor_id, ?1, dist + 1 FROM ancestry WHERE descendant_id = ?2
             UNION ALL SELECT ?2, ?1, 1`,
          )
          .bind(id, parent.id),
      );
    }
    try {
      await db.batch(stmts);
      setSession(c, `${id}.${secret}`);
      return c.json({ ok: true });
    } catch (e) {
      if (!String(e).includes("UNIQUE")) throw e; // an invite-code collision: try another code
    }
  }
  return c.json({ error: "busy" }, 503);
});

app.post("/api/vote", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "auth" }, 401);
  if (isOpen(c.env) !== "open") return c.json({ error: "closed" }, 409);
  await c.env.DB.prepare("UPDATE users SET voted_at = ?, confirm_code = ? WHERE id = ? AND voted_at IS NULL").bind(Date.now(), newCode(8), user.id).run();
  return c.json({ ok: true });
});

app.post("/api/plan", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "auth" }, 401);
  if (isOpen(c.env) === "after") return c.json({ error: "closed" }, 409);
  await c.env.DB.prepare("UPDATE users SET plan_at = ? WHERE id = ? AND plan_at IS NULL").bind(Date.now(), user.id).run();
  return c.json({ ok: true });
});

// One watering per Israel day until election day; yesterday's watering keeps the streak going.
app.post("/api/water", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "auth" }, 401);
  if (isOpen(c.env) === "after") return c.json({ error: "closed" }, 409);
  const today = israelDate();
  if (user.water_day === today) return c.json({ ok: true, already: true });
  const streak = user.water_day === israelDate(Date.now() - 86_400_000) ? user.water_streak + 1 : 1;
  await c.env.DB.prepare(
    "UPDATE users SET water_day = ?1, water_streak = ?2, water_total = water_total + 1 WHERE id = ?3 AND (water_day IS NULL OR water_day != ?1)",
  )
    .bind(today, streak, user.id)
    .run();
  return c.json({ ok: true, streak });
});

app.post("/api/species", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "auth" }, 401);
  const b = await body<{ species: unknown }>(c);
  const sp = SPECIES.find((s) => s.id === b.species);
  if (!sp) return c.json({ error: "species" }, 400);
  const a = await aggregate(c.env.DB, user.id);
  if (level(points({ ...a, ...user })).index < sp.level) return c.json({ error: "locked" }, 403);
  await c.env.DB.prepare("UPDATE users SET species = ? WHERE id = ?").bind(sp.id, user.id).run();
  return c.json({ ok: true });
});

// ---------- the witness stamp ----------

app.get("/api/confirm/:code", async (c) => {
  const me = await currentUser(c);
  const row = await c.env.DB.prepare(
    "SELECT u.id, u.name, u.voted_at, s.name AS by FROM users u LEFT JOIN users s ON s.id = u.confirmed_by WHERE u.confirm_code = ? AND u.key_hash != ''",
  )
    .bind(param(c, "code"))
    .first<{ id: string; name: string; voted_at: number | null; by: string | null }>();
  if (!row) return c.json({ error: "not_found" }, 404);
  const w: Witness = { name: row.name, voted: row.voted_at != null, confirmedBy: row.by, self: me?.id === row.id };
  return c.json(w);
});

app.post("/api/confirm/:code", async (c) => {
  const db = c.env.DB;
  const me = await currentUser(c);
  if (!me) return c.json({ error: "auth" }, 401);
  if (isOpen(c.env) !== "open") return c.json({ error: "closed" }, 409);
  const target = await db.prepare("SELECT id, confirmed_by FROM users WHERE confirm_code = ? AND voted_at IS NOT NULL").bind(param(c, "code")).first<{ id: string; confirmed_by: string | null }>();
  if (!target) return c.json({ error: "not_found" }, 404);
  if (target.id === me.id) return c.json({ error: "self" }, 400);
  if (target.confirmed_by) return c.json({ error: "stamped" }, 409);
  const n = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE confirmed_by = ?").bind(me.id).first<{ n: number }>();
  if ((n?.n ?? 0) >= STAMPS_PER_WITNESS) return c.json({ error: "stamps" }, 429);
  await db.prepare("UPDATE users SET confirmed_by = ?, confirmed_at = ? WHERE id = ? AND confirmed_by IS NULL").bind(me.id, Date.now(), target.id).run();
  return c.json({ ok: true });
});

// ---------- leagues ----------

app.get("/api/leaders", async (c) => {
  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/leaders", c.req.url).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return new Response(hit.body, hit);
  const leaders = (await ranked(c.env.DB, "1 = 1", [])).filter((l) => l.points > 0).slice(0, 20);
  const res = Response.json({ leaders }, { headers: { "Cache-Control": "public, max-age=30" } });
  c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
});

app.post("/api/leagues", async (c) => {
  const db = c.env.DB;
  const me = await currentUser(c);
  if (!me) return c.json({ error: "auth" }, 401);
  const name = cleanName((await body<{ name: unknown }>(c)).name, 30);
  if (!name) return c.json({ error: "name" }, 400);
  const owned = await db.prepare("SELECT COUNT(*) AS n FROM leagues WHERE owner_id = ?").bind(me.id).first<{ n: number }>();
  if ((owned?.n ?? 0) >= LEAGUES_OWNED) return c.json({ error: "leagues" }, 429);
  const id = crypto.randomUUID();
  const now = Date.now();
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = newCode();
    try {
      await db.batch([
        db.prepare("INSERT INTO leagues (id, code, name, owner_id, created_at) VALUES (?, ?, ?, ?, ?)").bind(id, code, name, me.id, now),
        db.prepare("INSERT INTO league_members (league_id, user_id, joined_at) VALUES (?, ?, ?)").bind(id, me.id, now),
      ]);
      return c.json({ ok: true, code });
    } catch (e) {
      if (!String(e).includes("UNIQUE")) throw e;
    }
  }
  return c.json({ error: "busy" }, 503);
});

app.get("/api/leagues/:code", async (c) => {
  const db = c.env.DB;
  const me = await currentUser(c);
  const league = await db.prepare("SELECT l.id, l.code, l.name, l.owner_id, u.name AS owner FROM leagues l JOIN users u ON u.id = l.owner_id WHERE l.code = ?").bind(param(c, "code")).first<{ id: string; code: string; name: string; owner_id: string; owner: string }>();
  if (!league) return c.json({ error: "not_found" }, 404);
  const members = await ranked(db, "u.id IN (SELECT user_id FROM league_members WHERE league_id = ?)", [league.id], me?.id);
  const res: League = {
    code: league.code,
    name: league.name,
    owner: league.owner,
    isMember: members.some((m) => m.me),
    isOwner: me?.id === league.owner_id,
    members: members.slice(0, LEAGUE_TABLE),
  };
  return c.json(res);
});

app.post("/api/leagues/:code/join", async (c) => {
  const db = c.env.DB;
  const me = await currentUser(c);
  if (!me) return c.json({ error: "auth" }, 401);
  const league = await db.prepare("SELECT id FROM leagues WHERE code = ?").bind(param(c, "code")).first<{ id: string }>();
  if (!league) return c.json({ error: "not_found" }, 404);
  const joined = await db.prepare("SELECT COUNT(*) AS n FROM league_members WHERE user_id = ?").bind(me.id).first<{ n: number }>();
  if ((joined?.n ?? 0) >= LEAGUES_JOINED) return c.json({ error: "leagues" }, 429);
  await db.prepare("INSERT OR IGNORE INTO league_members (league_id, user_id, joined_at) VALUES (?, ?, ?)").bind(league.id, me.id, Date.now()).run();
  return c.json({ ok: true });
});

app.post("/api/leagues/:code/leave", async (c) => {
  const me = await currentUser(c);
  if (!me) return c.json({ error: "auth" }, 401);
  await c.env.DB.prepare("DELETE FROM league_members WHERE user_id = ? AND league_id = (SELECT id FROM leagues WHERE code = ?)").bind(me.id, param(c, "code")).run();
  return c.json({ ok: true });
});

// ---------- the national pulse ----------

app.get("/api/pulse", async (c) => {
  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/pulse", c.req.url).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return new Response(hit.body, hit);
  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) AS people, COALESCE(SUM(voted_at IS NOT NULL), 0) AS voted,
            (SELECT COUNT(DISTINCT parent_id) FROM users WHERE parent_id IS NOT NULL) AS trees
     FROM users`,
  ).first<Pulse>();
  const res = Response.json(row ?? { people: 0, voted: 0, trees: 0 }, { headers: { "Cache-Control": "public, max-age=20" } });
  c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
});

// ---------- session ----------

app.post("/api/restore", async (c) => {
  const key = (await body<{ key: unknown }>(c)).key;
  if (typeof key !== "string") return c.json({ error: "key" }, 400);
  if (!(await userFromKey(c.env.DB, key))) return c.json({ error: "key" }, 404);
  setSession(c, key);
  return c.json({ ok: true });
});

app.post("/api/logout", (c) => {
  deleteCookie(c, COOKIE, { path: "/", secure: true });
  return c.json({ ok: true });
});

// Leaving keeps your place in the tree (so the people you invited keep theirs) but drops your
// name, your leagues, and makes your links stop working.
app.post("/api/leave", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "auth" }, 401);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET name = 'עלה אנונימי', key_hash = '', confirm_code = NULL WHERE id = ?").bind(user.id),
    c.env.DB.prepare("DELETE FROM league_members WHERE user_id = ?").bind(user.id),
  ]);
  deleteCookie(c, COOKIE, { path: "/", secure: true });
  return c.json({ ok: true });
});

app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

// ---------- shared links: the SPA, with a link preview that names who sent it ----------

async function preview(c: C, title: string | null, desc: string) {
  const page = await c.env.ASSETS.fetch(new Request(new URL("/", c.req.url)));
  if (!title) return page;
  return new HTMLRewriter()
    .on("title", { element: (el) => void el.setInnerContent(title) })
    .on('meta[property="og:title"]', { element: (el) => void el.setAttribute("content", title) })
    .on('meta[property="og:description"]', { element: (el) => void el.setAttribute("content", desc) })
    .on('meta[name="description"]', { element: (el) => void el.setAttribute("content", desc) })
    .transform(page);
}

app.get("/j/:code", async (c) => {
  const row = await c.env.DB.prepare("SELECT name FROM users WHERE code = ? AND key_hash != ''").bind(param(c, "code")).first<{ name: string }>();
  return preview(c, row ? `זרע מ־${row.name}: עץ ההצבעה` : null, "שותלים עץ, מזמינים חברים, וב־27.10 כל מי שהצביע הופך לפתק זהב.");
});

app.get("/l/:code", async (c) => {
  const row = await c.env.DB.prepare("SELECT name FROM leagues WHERE code = ?").bind(param(c, "code")).first<{ name: string }>();
  return preview(c, row ? `הליגה "${row.name}" בעץ ההצבעה` : null, "ליגה פרטית לקראת הבחירות: מי יגדל את העץ הכי זהוב עד 27.10?");
});

app.get("/c/:code", async (c) => {
  const row = await c.env.DB.prepare("SELECT name FROM users WHERE confirm_code = ? AND key_hash != ''").bind(param(c, "code")).first<{ name: string }>();
  return preview(c, row ? `חותמת עד ל־${row.name}` : null, "ראית את המעטפה נכנסת לקלפי? חותמת עד אחת שווה 10 טיפות.");
});

export default app;
