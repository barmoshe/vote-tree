import { Hono, type Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { daysUntil, phase } from "../shared/election";
import { POINTS } from "../shared/game";
import type { Leader, Me, MeResponse, TreeNode } from "../shared/api";

type Env = { DB: D1Database; ASSETS: Fetcher; VOTING_OPEN?: string };
type User = {
  id: string;
  name: string;
  code: string;
  parent_id: string | null;
  key_hash: string;
  created_at: number;
  voted_at: number | null;
};

const COOKIE = "vt";
const YEAR = 60 * 60 * 24 * 365;
const TREE_DEPTH = 5;
const TREE_LIMIT = 400;
const JOINS_PER_HOUR = 12;

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

// Short invite codes from an alphabet with no look-alikes (no 0/O, 1/l/I).
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

function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const s = raw
    .replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length < 2 || s.length > 24) return null;
  if (/https?:|www\.|\.com|@/i.test(s)) return null;
  return s;
}

function isOpen(env: Env) {
  return phase(Date.now(), env.VOTING_OPEN === "1");
}

async function currentUser(c: Context<{ Bindings: Env }>) {
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

function setSession(c: Parameters<typeof setCookie>[0], value: string) {
  setCookie(c, COOKIE, value, { path: "/", httpOnly: true, secure: true, sameSite: "Lax", maxAge: YEAR });
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

function points(voted: boolean, a: Agg) {
  return (
    (voted ? POINTS.selfVoted : 0) +
    a.dj * POINTS.inviteJoined +
    a.dv * POINTS.directVoted +
    (a.tv - a.dv) * POINTS.deeperVoted
  );
}

async function loadMe(db: D1Database, user: User, key: string): Promise<Me> {
  const [agg, rows, inviter] = await db.batch([
    db
      .prepare(
        `SELECT COALESCE(SUM(a.dist = 1), 0) AS dj, COUNT(*) AS tj,
                COALESCE(SUM(a.dist = 1 AND d.voted_at IS NOT NULL), 0) AS dv,
                COALESCE(SUM(d.voted_at IS NOT NULL), 0) AS tv,
                COALESCE(MAX(a.dist), 0) AS depth
         FROM ancestry a JOIN users d ON d.id = a.descendant_id
         WHERE a.ancestor_id = ?`,
      )
      .bind(user.id),
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
  ]);
  const a = (agg.results[0] as Agg | undefined) ?? { dj: 0, tj: 0, dv: 0, tv: 0, depth: 0 };
  const list = rows.results as { id: string; parent_id: string; name: string; voted_at: number | null; dist: number }[];
  const truncated = list.length > TREE_LIMIT;

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

  const voted = user.voted_at != null;
  return {
    name: user.name,
    code: user.code,
    key,
    inviter: (inviter.results[0] as { name: string } | undefined)?.name ?? null,
    stats: {
      voted,
      directJoined: a.dj,
      totalJoined: a.tj,
      directVoted: a.dv,
      totalVoted: a.tv,
      depth: a.depth,
    },
    points: points(voted, a),
    tree,
    treeTruncated: truncated,
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
  c.header("Cache-Control", "no-store");
});

app.get("/api/me", async (c) => {
  const raw = getCookie(c, COOKIE);
  const user = raw ? await userFromKey(c.env.DB, raw) : null;
  const body: MeResponse = {
    me: user && raw ? await loadMe(c.env.DB, user, raw) : null,
    phase: isOpen(c.env),
    daysUntil: daysUntil(),
  };
  return c.json(body);
});

app.get("/api/invite/:code", async (c) => {
  const row = await c.env.DB.prepare("SELECT name FROM users WHERE code = ? AND key_hash != ''")
    .bind(c.req.param("code").toLowerCase())
    .first<{ name: string }>();
  return row ? c.json({ name: row.name }) : c.json({ error: "not_found" }, 404);
});

app.post("/api/join", async (c) => {
  const db = c.env.DB;
  const existing = await currentUser(c);
  if (existing) return c.json({ ok: true, already: true });

  const body = await c.req.json<{ name?: unknown; ref?: unknown }>().catch(() => ({}) as { name?: unknown; ref?: unknown });
  const name = cleanName(body.name);
  if (!name) return c.json({ error: "name" }, 400);

  const ip = c.req.header("cf-connecting-ip") ?? "local";
  if (await limited(db, "join:" + (await sha256(ip)).slice(0, 16), JOINS_PER_HOUR, 3_600_000)) {
    return c.json({ error: "rate" }, 429);
  }

  let parent: { id: string } | null = null;
  if (typeof body.ref === "string" && body.ref) {
    parent = await db.prepare("SELECT id FROM users WHERE code = ?").bind(body.ref.toLowerCase()).first<{ id: string }>();
  }

  const id = crypto.randomUUID();
  const secret = randomKey();
  const hash = await sha256(secret);
  const now = Date.now();

  for (let attempt = 0; attempt < 4; attempt++) {
    const code = newCode();
    const stmts = [
      db
        .prepare("INSERT INTO users (id, name, code, parent_id, key_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(id, name, code, parent?.id ?? null, hash, now),
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
  await c.env.DB.prepare("UPDATE users SET voted_at = ? WHERE id = ? AND voted_at IS NULL").bind(Date.now(), user.id).run();
  return c.json({ ok: true });
});

app.post("/api/restore", async (c) => {
  const body = await c.req.json<{ key?: unknown }>().catch(() => ({}) as { key?: unknown });
  if (typeof body.key !== "string") return c.json({ error: "key" }, 400);
  const user = await userFromKey(c.env.DB, body.key);
  if (!user) return c.json({ error: "key" }, 404);
  setSession(c, body.key);
  return c.json({ ok: true });
});

app.post("/api/logout", (c) => {
  deleteCookie(c, COOKIE, { path: "/", secure: true });
  return c.json({ ok: true });
});

// Leaving keeps your place in the tree (so the people you invited keep theirs) but drops your
// name and makes your link stop working.
app.post("/api/leave", async (c) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: "auth" }, 401);
  await c.env.DB.prepare("UPDATE users SET name = 'עלה אנונימי', key_hash = '' WHERE id = ?").bind(user.id).run();
  deleteCookie(c, COOKIE, { path: "/", secure: true });
  return c.json({ ok: true });
});

app.get("/api/leaders", async (c) => {
  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/leaders", c.req.url).toString());
  const hit = await cache.match(cacheKey);
  if (hit) return new Response(hit.body, hit);

  const { results } = await c.env.DB.prepare(
    `SELECT u.name, u.voted_at,
            SUM(a.dist = 1) AS dj, COUNT(*) AS tj,
            SUM(a.dist = 1 AND d.voted_at IS NOT NULL) AS dv,
            SUM(d.voted_at IS NOT NULL) AS tv
     FROM users u
     JOIN ancestry a ON a.ancestor_id = u.id
     JOIN users d ON d.id = a.descendant_id
     WHERE u.key_hash != ''
     GROUP BY u.id`,
  ).all<Agg & { name: string; voted_at: number | null }>();

  const leaders: Leader[] = results
    .map((r) => ({ name: r.name, points: points(r.voted_at != null, r), joined: r.tj, voted: r.tv }))
    .sort((x, y) => y.points - x.points || y.joined - x.joined)
    .slice(0, 20);

  const res = Response.json({ leaders }, { headers: { "Cache-Control": "public, max-age=30" } });
  c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
});

app.all("/api/*", (c) => c.json({ error: "not_found" }, 404));

// ---------- invite pages: the SPA, with the inviter's name in the link preview ----------

app.get("/j/:code", async (c) => {
  const page = await c.env.ASSETS.fetch(new Request(new URL("/", c.req.url)));
  const row = await c.env.DB.prepare("SELECT name FROM users WHERE code = ? AND key_hash != ''")
    .bind(c.req.param("code").toLowerCase())
    .first<{ name: string }>();
  if (!row) return page;
  const title = `הזמנה מ־${row.name} לעץ ההצבעה`;
  const desc = "קישור אישי, חברים שמזמינים חברים, וביום הבחירות כל מי שהצביע הופך לעלה זהב בעץ.";
  return new HTMLRewriter()
    .on("title", { element: (el) => void el.setInnerContent(title) })
    .on('meta[property="og:title"]', { element: (el) => void el.setAttribute("content", title) })
    .on('meta[property="og:description"]', { element: (el) => void el.setAttribute("content", desc) })
    .on('meta[name="description"]', { element: (el) => void el.setAttribute("content", desc) })
    .transform(page);
});

export default app;
