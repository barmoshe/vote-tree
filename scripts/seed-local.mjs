// Grows a small test tree under an invite code on a local `wrangler dev`, through the real API.
// Usage: node scripts/seed-local.mjs <code> [base]   (local only: refuses a non-localhost base)
const [code, base = "http://localhost:8793"] = process.argv.slice(2);
if (!code) throw new Error("usage: node scripts/seed-local.mjs <code> [base]");
if (!/^http:\/\/(localhost|127\.0\.0\.1)/.test(base)) throw new Error("local only");

async function call(path, cookie, body) {
  const res = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: { origin: base, "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.get("set-cookie");
  return { json: await res.json(), cookie: set ? set.split(";")[0] : cookie };
}

async function join(name, ref) {
  const { cookie, json } = await call("/api/join", null, { name, ref });
  if (!json.ok) throw new Error(name + ": " + JSON.stringify(json));
  const me = (await call("/api/me", cookie)).json.me;
  return { name, cookie, code: me.code };
}

const plan = [
  ["נועה", 0, true],
  ["איתי", 0, true],
  ["מאיה", 0, false],
  ["יוסי", 1, true],
  ["רותם", 1, false],
  ["דנה", 2, true],
  ["עומר", 4, true],
  ["שירה", 7, false],
  ["אבי", 7, true],
];
const people = [{ code }];
for (const [name, parent, votes] of plan) {
  const p = await join(name, people[parent].code);
  people.push(p);
  if (votes) await call("/api/vote", p.cookie, {});
  console.log(name, "->", parent, votes ? "voted" : "");
}
