# עץ ההצבעה · Vote Tree

A get-out-the-vote game for the Israeli Knesset election on 27.10.2026. Everyone gets a personal
invite link. Friends who join through it grow your tree, and the people they invite grow it further.
On election day each person taps "I voted" and their leaf turns gold, so you can see how many people
voted because of you, directly and further down the tree.

Live: https://vote-tree.barprojectsandbuilds.workers.dev

It never asks, stores or shows who anyone voted for. The only personal data is a display name and
who invited whom; there is no phone, email or password. Points are symbolic: no prizes and nothing
of value.

## How it works

| Event | Points |
|---|---|
| Watering once a day until election day | +1 |
| Someone you invited joined | +1 |
| A voting plan (when, how, with whom) | +3 |
| You voted | +10 |
| A friend who was there stamps your vote as witness | +10 |
| Someone you invited voted | +5 |
| Someone further down your tree voted | +1 |

Points unlock levels (pot, sprout, sapling, tree, grove, forest), tree species, achievements, a place
in the national league and in private leagues anyone can open for their friends. Marking a vote opens on 27.10 at 07:00 Israel time and closes at 23:59. It is an honor
system: there is no way to check a vote without hurting privacy, and the points are worth nothing
outside the tree.

In your own tree you see by name only the people you invited yourself; everyone further down is an
anonymous leaf.

## Stack

One Cloudflare Worker:

- **API**: [Hono](https://hono.dev) in `src/worker/`, behind `/api/*`.
- **Database**: Cloudflare D1. A closure table (`ancestry`) holds every ancestor/descendant pair, so
  a whole tree and its totals are one indexed query.
- **Pages**: a React SPA (Vite) in `src/web/`, served as static assets. The scene is pixel art on a
  canvas (Resurrect 64 palette by Kerrie Lake) with a vector layer for text, the flag and the ballot box. `/j/<code>` goes through the
  Worker so the WhatsApp preview shows the inviter's name.
- **Sessions**: an HttpOnly cookie `<id>.<key>`; only a SHA-256 of the key is stored. The personal
  `/restore#<key>` link is the way back in from another device.

## Run it

```bash
npm install
npm run db:local
npm run dev
```

`npm run dev` builds the SPA and starts `wrangler dev`. Add `--var VOTING_OPEN:1` to the
`wrangler dev` call to test the election-day button early, and
`node scripts/seed-local.mjs <your invite code>` grows a small test tree through the real API.

Deploy with `npm run db:remote` (migrations) and `npm run deploy`. `scripts/og.sh` re-renders the
link-preview image from `/og-card` on a running local server.

Built at the 2026 election hackathon. Not affiliated with any party.
