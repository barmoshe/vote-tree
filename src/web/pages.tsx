import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { api, errorText } from "./api";
import { Link, navigate } from "./router";
import { TreeSvg } from "./TreeSvg";
import { demoTree } from "./demoTree";
import { ACHIEVEMENTS, LEVELS, POINTS, level } from "../shared/game";
import { ELECTION_DATE_LABEL } from "../shared/election";
import type { Leader, MeResponse } from "../shared/api";

// ---------- shared bits ----------

function useMe() {
  const [data, setData] = useState<MeResponse | null>(null);
  const reload = () => api.me().then(setData).catch(() => setData({ me: null, phase: "before", daysUntil: 0 }));
  useEffect(() => void reload(), []);
  return { data, reload };
}

function Loading() {
  return (
    <p className="loading" role="status">
      טוען…
    </p>
  );
}

const sample = demoTree(11, 34, 3, 5);
const sampleVoted = new Set(sample.filter((n) => n.t != null && n.t < 15).map((n) => n.i));

function PointsTable() {
  return (
    <table className="points">
      <tbody>
        <tr>
          <th scope="row">מישהו הצטרף דרך הקישור שלך</th>
          <td>+{POINTS.inviteJoined}</td>
        </tr>
        <tr>
          <th scope="row">הצבעת</th>
          <td>+{POINTS.selfVoted}</td>
        </tr>
        <tr>
          <th scope="row">מישהו שהזמנת הצביע</th>
          <td>+{POINTS.directVoted}</td>
        </tr>
        <tr>
          <th scope="row">מישהו בהמשך העץ שלך הצביע</th>
          <td>+{POINTS.deeperVoted}</td>
        </tr>
      </tbody>
    </table>
  );
}

// ---------- home and invite ----------

export function Home({ code }: { code?: string }) {
  const { data } = useMe();
  const [inviter, setInviter] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (code) api.invite(code).then((r) => setInviter(r?.name ?? null));
  }, [code]);

  async function join(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.join(name, code);
      navigate("/tree");
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  const signedIn = !!data?.me;

  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">בחירות לכנסת · יום שלישי, {ELECTION_DATE_LABEL}</p>
          <h1>עץ ההצבעה</h1>
          <p className="lead">
            קישור אישי שעובר מחבר לחבר. ביום הבחירות כל מי שהצביע הופך לעלה זהב, ורואים כמה אנשים יצאו להצביע בזכותך.
          </p>

          {inviter && (
            <p className="invite-note">
              קיבלת הזמנה מ־<strong>{inviter}</strong>. ההצטרפות מחברת אותך לעץ של {inviter}.
            </p>
          )}

          {!data ? (
            <Loading />
          ) : signedIn ? (
            <div className="card join">
              <p>כבר יש לך עץ במכשיר הזה.</p>
              <Link className="btn" href="/tree">
                לעץ שלי
              </Link>
            </div>
          ) : (
            <form className="card join" onSubmit={join}>
              <label htmlFor="name">שם תצוגה</label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={24}
                required
                autoComplete="nickname"
                aria-describedby="name-hint"
              />
              <p id="name-hint" className="hint">
                ככה יראו אותך מי שהזמין אותך ומי שיצטרפו דרכך. אפשר כינוי.
              </p>
              <button className="btn" disabled={busy}>
                {busy ? "שותלים…" : "להצטרפות לעץ"}
              </button>
              <p className="hint">בלי טלפון, בלי מייל, בלי סיסמה.</p>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
            </form>
          )}
        </div>
        <div className="hero-tree">
          <TreeSvg nodes={sample} votedAt={(i) => sampleVoted.has(i)} label="עץ לדוגמה: עלים ירוקים הצטרפו, עלים זהובים הצביעו" />
        </div>
      </section>

      <section className="container steps" aria-labelledby="how">
        <h2 id="how">איך זה עובד</h2>
        <ol>
          <li>
            <h3>קישור משלך</h3>
            <p>ההצטרפות נותנת לך קישור אישי לשליחה בוואטסאפ.</p>
          </li>
          <li>
            <h3>חברים מזמינים חברים</h3>
            <p>מי שמצטרף דרכך נכנס לעץ שלך, וגם כל מי שהוא יזמין, וכן הלאה.</p>
          </li>
          <li>
            <h3>{ELECTION_DATE_LABEL}: הצבעתי</h3>
            <p>ביום הבחירות לוחצים &quot;הצבעתי&quot;. רק שהצבעת, אף פעם לא למי.</p>
          </li>
        </ol>
      </section>

      <section className="container split" aria-labelledby="pts">
        <div>
          <h2 id="pts">נקודות ודרגות</h2>
          <PointsTable />
          <p className="ladder" aria-label="הדרגות">
            {LEVELS.map((l, k) => (
              <span key={l.name}>
                {k > 0 && <span aria-hidden="true"> ← </span>}
                {l.name}
              </span>
            ))}
          </p>
          <p className="hint">הנקודות סמליות. אין פרסים, אין הגרלות ואין שום תמורה.</p>
        </div>
        <div className="card demo-cta">
          <h2>איך זה נראה ביום עצמו?</h2>
          <p>עץ מומצא, משבע בבוקר עד עשר בלילה, בעשרים שניות.</p>
          <Link className="btn btn-ghost" href="/demo">
            להדגמה
          </Link>
        </div>
      </section>
    </>
  );
}

// ---------- my tree ----------

function ShareCard({ code }: { code: string }) {
  const url = `${location.origin}/j/${code}`;
  const [copied, setCopied] = useState(false);
  const text = `אני בעץ ההצבעה. מצטרפים דרך הקישור שלי, וב־${ELECTION_DATE_LABEL} כל מי שהצביע הופך לעלה זהב: ${url}`;
  async function copy() {
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <section className="card share" aria-labelledby="share-h">
      <h2 id="share-h">הקישור האישי שלך</h2>
      <p className="link-box" dir="ltr">
        {url.replace(/^https?:\/\//, "")}
      </p>
      <div className="row">
        <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">
          שליחה בוואטסאפ
        </a>
        <button className="btn btn-ghost" onClick={copy}>
          {copied ? "הועתק" : "העתקת הקישור"}
        </button>
        {"share" in navigator && (
          <button className="btn btn-ghost" onClick={() => navigator.share({ text }).catch(() => {})}>
            שיתוף
          </button>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {copied ? "הקישור הועתק" : ""}
      </p>
    </section>
  );
}

function VoteCard({ data, onVoted }: { data: MeResponse; onVoted: () => void }) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const me = data.me!;
  async function vote() {
    try {
      await api.vote();
      onVoted();
    } catch (e) {
      setError(errorText(e));
    }
  }
  if (me.stats.voted)
    return (
      <section className="card vote vote-done">
        <h2>הצבעת</h2>
        <p>העלה שלך זהב עכשיו. כל מי שיצביע בעץ שלך יוסיף לך נקודות עד סוף היום.</p>
      </section>
    );
  if (data.phase === "before")
    return (
      <section className="card vote">
        <p className="count">
          <span>{data.daysUntil}</span> ימים לבחירות
        </p>
        <p>עד אז העץ גדל מהזמנות. ביום הבחירות יופיע כאן כפתור &quot;הצבעתי&quot;.</p>
      </section>
    );
  if (data.phase === "after")
    return (
      <section className="card vote">
        <h2>הבחירות נגמרו</h2>
        <p>תודה שהיית חלק מהעץ.</p>
      </section>
    );
  return (
    <section className="card vote vote-open">
      <h2>היום בוחרים</h2>
      {!asking ? (
        <button className="btn btn-gold" onClick={() => setAsking(true)}>
          הצבעתי
        </button>
      ) : (
        <div className="confirm">
          <p>לאשר שהצבעת היום? לא שואלים למי, ולא שומרים.</p>
          <div className="row">
            <button className="btn btn-gold" onClick={vote}>
              כן, הצבעתי
            </button>
            <button className="btn btn-ghost" onClick={() => setAsking(false)}>
              עוד לא
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function AccountCard({ k, onGone }: { k: string; onGone: () => void }) {
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const url = `${location.origin}/restore#${k}`;
  return (
    <section className="card account" aria-labelledby="acc-h">
      <h2 id="acc-h">הקישור הפרטי לחזרה</h2>
      <p>
        אין סיסמה, אז זו הדרך היחידה להיכנס לעץ שלך מטלפון אחר. כדאי לשמור אותו אצלך (למשל בהודעה לעצמך), ולא לשלוח
        אותו לאף אחד.
      </p>
      <div className="row">
        <button
          className="btn btn-ghost"
          onClick={async () => {
            await navigator.clipboard.writeText(url).catch(() => {});
            setCopied(true);
          }}
        >
          {copied ? "הועתק" : "העתקת הקישור הפרטי"}
        </button>
        <button className="btn btn-ghost" onClick={() => api.logout().then(onGone)}>
          יציאה מהמכשיר הזה
        </button>
      </div>
      <details className="leave">
        <summary>מחיקת השם שלי מהעץ</summary>
        <p>
          המקום שלך נשאר כדי שמי שהזמנת לא יאבד את העץ שלו, אבל השם שלך יימחק והקישורים שלך יפסיקו לעבוד. אי אפשר
          לבטל.
        </p>
        {!leaving ? (
          <button className="btn btn-danger" onClick={() => setLeaving(true)}>
            מחיקה
          </button>
        ) : (
          <button className="btn btn-danger" onClick={() => api.leave().then(onGone)}>
            כן, למחוק
          </button>
        )}
      </details>
    </section>
  );
}

export function MyTree() {
  const { data, reload } = useMe();
  useEffect(() => {
    if (data && !data.me) navigate("/", true);
  }, [data]);
  if (!data?.me) return <div className="container page"><Loading /></div>;

  const me = data.me;
  const lv = level(me.points);
  const s = me.stats;
  const done = ACHIEVEMENTS.filter((a) => a.done(s)).length;

  return (
    <div className="container page tree-page">
      <header className="tree-head">
        <div>
          <p className="eyebrow">{me.inviter ? `הגעת דרך ${me.inviter}` : "העץ שלך"}</p>
          <h1>העץ של {me.name}</h1>
        </div>
        <div className="level" aria-label={`דרגה: ${lv.name}, ${me.points} נקודות`}>
          <span className="level-name">{lv.name}</span>
          <span className="level-pts">{me.points} נקודות</span>
          {lv.next && (
            <>
              <span className="bar" aria-hidden="true">
                <span style={{ width: `${Math.round(lv.progress * 100)}%` }} />
              </span>
              <span className="hint">
                עוד {lv.next.at - me.points} ל{lv.next.name}
              </span>
            </>
          )}
        </div>
      </header>

      <div className="tree-grid">
        <div className="tree-main">
          <figure className="card tree-card">
            <TreeSvg nodes={me.tree} label={`העץ של ${me.name}: ${s.totalJoined} אנשים, ${s.totalVoted} הצביעו`} />
            <figcaption>
              {s.totalJoined === 0 ? (
                <>העץ עוד ריק. הקישור שלך הוא הזרע.</>
              ) : (
                <>
                  <span className="key key-leaf" /> הצטרפו <span className="key key-gold" /> הצביעו
                  {me.treeTruncated && <> · מוצגים 400 הראשונים</>}
                </>
              )}
            </figcaption>
          </figure>

          <dl className="stats">
            <div>
              <dt>הצטרפו דרכך</dt>
              <dd>{s.directJoined}</dd>
            </div>
            <div>
              <dt>בכל העץ</dt>
              <dd>{s.totalJoined}</dd>
            </div>
            <div>
              <dt>הצביעו בעץ</dt>
              <dd>{s.totalVoted}</dd>
            </div>
            <div>
              <dt>דורות</dt>
              <dd>{s.depth}</dd>
            </div>
          </dl>
        </div>

        <div className="tree-side">
          <VoteCard data={data} onVoted={reload} />
          <ShareCard code={me.code} />
        </div>
      </div>

      <section aria-labelledby="ach-h" className="achievements">
        <h2 id="ach-h">
          הישגים <span className="hint">({done} מתוך {ACHIEVEMENTS.length})</span>
        </h2>
        <ul>
          {ACHIEVEMENTS.map((a) => {
            const ok = a.done(s);
            return (
              <li key={a.id} className={ok ? "ach ach-on" : "ach"}>
                <span className="ach-dot" aria-hidden="true" />
                <strong>{a.title}</strong>
                <span>{a.hint}</span>
                <span className="sr-only">{ok ? "הושג" : "עוד לא"}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <AccountCard k={me.key} onGone={() => navigate("/", true)} />
    </div>
  );
}

// ---------- leaders ----------

export function Leaders() {
  const [rows, setRows] = useState<Leader[] | null>(null);
  useEffect(() => {
    api.leaders().then((r) => setRows(r.leaders)).catch(() => setRows([]));
  }, []);
  return (
    <div className="container page narrow">
      <h1>העצים הגדולים</h1>
      <p className="lead">לפי נקודות. רק מי שמישהו כבר הצטרף דרכו.</p>
      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p>עוד אין עצים בטבלה. העץ הראשון יכול להיות שלך.</p>
      ) : (
        <table className="leaders">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">שם</th>
              <th scope="col">דרגה</th>
              <th scope="col">בעץ</th>
              <th scope="col">הצביעו</th>
              <th scope="col">נקודות</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, k) => (
              <tr key={k}>
                <td>{k + 1}</td>
                <td>{r.name}</td>
                <td>{level(r.points).name}</td>
                <td>{r.joined}</td>
                <td>{r.voted}</td>
                <td>
                  <strong>{r.points}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------- demo ----------

const DEMO = demoTree(27, 120, 5, 6);
const START = 7;
const END = 22;
const RUN_MS = 20_000;

function clock(h: number) {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function Demo() {
  const [hour, setHour] = useState(START);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setHour((h) => {
        const next = Math.min(END, h + ((END - START) * dt) / RUN_MS);
        if (next >= END) setPlaying(false);
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const stats = useMemo(() => {
    const parent = new Map(DEMO.map((n) => [n.i, n.p]));
    const depthOf = (i: number) => {
      let d = 0;
      for (let p = parent.get(i); p != null; p = parent.get(p)) d++;
      return d;
    };
    let total = 0, voted = 0, direct = 0, directVoted = 0;
    for (const n of DEMO.slice(1)) {
      total++;
      const d = depthOf(n.i);
      const v = n.t != null && n.t <= hour;
      if (v) voted++;
      if (d === 1) {
        direct++;
        if (v) directVoted++;
      }
    }
    const meVoted = DEMO[0].t! <= hour;
    const pts = (meVoted ? POINTS.selfVoted : 0) + direct * POINTS.inviteJoined + directVoted * POINTS.directVoted + (voted - directVoted) * POINTS.deeperVoted;
    return { total, voted, pts, meVoted };
  }, [hour]);

  const votedAt = (i: number) => {
    const t = DEMO[i].t;
    return t != null && t <= hour;
  };

  return (
    <div className="container page demo">
      <p className="eyebrow">הדגמה · עץ מומצא, לא נתונים אמיתיים</p>
      <h1>יום בחירות בעץ אחד</h1>
      <p className="lead">שישה חברים שהוזמנו, וכל מי שהם הזמינו אחריהם. כל עלה שמזהיב הוא מישהו שיצא להצביע.</p>

      <div className="demo-grid">
        <figure className="card tree-card">
          <TreeSvg nodes={DEMO} votedAt={votedAt} label={`עץ הדגמה בשעה ${clock(hour)}: ${stats.voted} מתוך ${stats.total} הצביעו`} animate={false} showNames={false} />
        </figure>
        <div className="demo-side">
          <p className="demo-clock" aria-live="off">
            {clock(hour)}
          </p>
          <div className="row">
            <button
              className="btn"
              onClick={() => {
                if (hour >= END) setHour(START);
                setPlaying((p) => !p);
              }}
            >
              {playing ? "עצירה" : hour >= END ? "מההתחלה" : "הפעלה"}
            </button>
          </div>
          <label className="slider">
            <span>שעה ביום הבחירות</span>
            <input
              type="range"
              min={START}
              max={END}
              step={0.05}
              value={hour}
              onChange={(e) => {
                setPlaying(false);
                setHour(Number(e.target.value));
              }}
              aria-valuetext={clock(hour)}
            />
          </label>
          <dl className="stats stats-col">
            <div>
              <dt>הצביעו</dt>
              <dd>
                {stats.voted} <small>מתוך {stats.total}</small>
              </dd>
            </div>
            <div>
              <dt>נקודות</dt>
              <dd>{stats.pts}</dd>
            </div>
            <div>
              <dt>דרגה</dt>
              <dd>{level(stats.pts).name}</dd>
            </div>
          </dl>
          <Link className="btn btn-ghost" href="/">
            לפתוח עץ אמיתי
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------- about ----------

export function About() {
  return (
    <div className="container page narrow prose">
      <h1>איך זה עובד</h1>
      <p>
        עץ ההצבעה הופך את היציאה לקלפי ממשהו פרטי למשהו שעושים עם חברים. ההצטרפות נותנת לך קישור אישי. מי שמצטרף דרכו
        נכנס לעץ שלך, וגם מי שהוא מזמין. ביום הבחירות, {ELECTION_DATE_LABEL}, כל מי שהצביע לוחץ &quot;הצבעתי&quot; והעלה
        שלו מזהיב, אצלו ואצל כל מי שמעליו בעץ.
      </p>

      <h2>נקודות</h2>
      <PointsTable />
      <p>
        הנקודות סמליות. אין פרסים, אין הגרלות ואין שום תמורה, וכך זה יישאר. הן שם בשביל הדרגות, ההישגים וטבלת העצים
        הגדולים.
      </p>

      <h2>מה נשמר ומה לא</h2>
      <p>
        נשמרים שם התצוגה שבחרת, מי הזמין את מי, ומתי סימנת שהצבעת. לא נשמרים טלפון, מייל או מיקום. העץ לא שואל, לא שומר
        ולא מציג במי בחרת, ואין בו שום מסר בעד או נגד מפלגה.
      </p>
      <p>
        בעץ שלך רואים בשם רק את מי שהזמנת בעצמך. מי שהגיע דרכם מופיע כעלה בלי שם. מחיקת השם אפשרית בכל רגע מתחתית העמוד
        של העץ שלך.
      </p>

      <h2>למה אין אימות אמיתי</h2>
      <p>
        אין דרך לבדוק שמישהו באמת הצביע בלי לפגוע בפרטיות שלו, ולכן לא נבקש תמונה, מסמך או מיקום. הסימון מבוסס על אמון.
        הנקודות לא שוות כלום מחוץ לעץ, כך שאין סיבה לרמות.
      </p>

      <h2>מאיפה זה בא</h2>
      <p>הרעיון עלה בהאקתון בחירות 2026, ונבנה שם כפרויקט קהילתי שלא קשור לשום מפלגה.</p>
    </div>
  );
}

// ---------- restore ----------

export function Restore() {
  const [state, setState] = useState<"working" | "bad">("working");
  useEffect(() => {
    const key = decodeURIComponent(location.hash.slice(1));
    history.replaceState(null, "", "/restore");
    if (!key) return setState("bad");
    api
      .restore(key)
      .then(() => navigate("/tree", true))
      .catch(() => setState("bad"));
  }, []);
  return (
    <div className="container page narrow">
      <h1>חזרה לעץ</h1>
      {state === "working" ? (
        <Loading />
      ) : (
        <>
          <p>הקישור הזה לא עובד. אולי הוא הועתק חלקית, או שהשם נמחק מהעץ.</p>
          <Link className="btn" href="/">
            לדף הבית
          </Link>
        </>
      )}
    </div>
  );
}

// ---------- the link-preview image (rendered to public/og.png by scripts/og.sh) ----------

export function OgCard() {
  return (
    <div className="og">
      <div className="og-copy">
        <p className="eyebrow">בחירות לכנסת · {ELECTION_DATE_LABEL}</p>
        <h1>עץ ההצבעה</h1>
        <p>חברים מזמינים חברים. ביום הבחירות, כל מי שהצביע הופך לעלה זהב.</p>
      </div>
      <div className="og-tree">
        <TreeSvg nodes={sample} votedAt={(i) => sampleVoted.has(i)} label="" animate={false} showNames={false} />
      </div>
    </div>
  );
}
