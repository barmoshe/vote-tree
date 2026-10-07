import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, errorText } from "./api";
import { Link, navigate } from "./router";
import { LeafChip, Scene } from "./Scene";
import { demoStory, demoTree, STORY_DAYS } from "./demoTree";
import { celebrate, Modal, Sheet, useIsPhone } from "./fx";
import { Icon } from "./icons";
import { download, preparePhoto, shareOrDownload, storyCard, voteIcs } from "./share";
import { ACHIEVEMENTS, LEVELS, POINTS, SPECIES, level, pointsOf } from "../shared/game";
import { ELECTION_DATE_LABEL } from "../shared/election";
import type { League, Leader, Me, MeResponse, Pulse, Witness } from "../shared/api";

const POLL_LOOKUP = "https://bechirot.gov.il";

// ---------- shared bits ----------

function useMe() {
  const [data, setData] = useState<MeResponse | null>(null);
  const reload = () => api.me().then(setData).catch(() => setData({ me: null, phase: "before", daysUntil: 0 }));
  useEffect(() => void reload(), []);
  return { data, reload };
}

function usePulse() {
  const [p, setP] = useState<Pulse | null>(null);
  useEffect(() => {
    api.pulse().then(setP).catch(() => {});
  }, []);
  return p;
}

function Loading() {
  return (
    <p className="loading" role="status">
      <span className="spin" aria-hidden="true">
        <Icon name="sprout" />       </span>{" "}
      רגע…
    </p>
  );
}

function ErrorLine({ text }: { text: string }) {
  return text ? (
    <p className="error" role="alert">
      {text}
    </p>
  ) : null;
}

function PulseBar({ p }: { p: Pulse | null }) {
  if (!p) return null;
  if (p.people === 0) return <p className="pulse"><Icon name="tree" /> היער הלאומי עוד ריק. העץ הראשון יכול להיות שלך.</p>;
  return (
    <ul className="pulse" aria-label="היער הלאומי">
      <li>
        <b>{p.people}</b> עצים שתולים
      </li>
      <li>
        <b>{p.trees}</b> עם ענפים
      </li>
      <li className="pulse-gold">
        <b>{p.voted}</b> פתקי זהב
      </li>
    </ul>
  );
}

function DropsTable() {
  const rows: [string, number][] = [
    ["השקיה יומית עד יום הבחירות", POINTS.water],
    ["מישהו הצטרף דרך הקישור שלך", POINTS.inviteJoined],
    ["תוכנית הצבעה: מתי, איך ועם מי", POINTS.plan],
    ["סימנת שהצבעת ב־27.10", POINTS.selfVoted],
    ["חבר שהיה איתך החתים חותמת עד", POINTS.confirmed],
    ["תמונה מבחוץ לקלפי, שחברי הליגה לא סימנו", POINTS.photo],
    ["מישהו שהזמנת הצביע", POINTS.directVoted],
    ["מישהו בהמשך העץ שלך הצביע", POINTS.deeperVoted],
  ];
  return (
    <table className="drops-table">
      <tbody>
        {rows.map(([t, n]) => (
          <tr key={t}>
            <th scope="row">{t}</th>
            <td>+{n} <Icon name="drop" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A ballot slip: the flag's double stripes, top and bottom. */
function Slip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`slip-card ${className}`}>{children}</div>;
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string, id = "x") => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(id);
    setTimeout(() => setCopied(null), 1800);
  };
  return [copied, copy] as const;
}

// The home page's picture: a made-up tree, deterministic.
const sample = demoTree(11, 40, 3, 5);
const sampleVoted = new Set(sample.filter((n) => n.t != null && n.t < 14).map((n) => n.i));

// ---------- home and invite ----------

export function Home({ code }: { code?: string }) {
  const { data } = useMe();
  const phone = useIsPhone();
  const dock = useRef<HTMLDivElement>(null);
  const [dockH, setDockH] = useState(0);
  useEffect(() => {
    const el = dock.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDockH(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [phone, data]);
  const pulse = usePulse();
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
      sessionStorage.setItem("vt_welcome", "1");
      navigate(sessionStorage.getItem("vt_after_join") ?? "/tree");
      sessionStorage.removeItem("vt_after_join");
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  const joinForm = !data ? (
    <Loading />
  ) : data.me ? (
    <Link className="btn btn-big" href="/tree">
      <Icon name="tree" /> לעץ שלי
    </Link>
  ) : (
    <form className="phone-join" onSubmit={join}>
      <label htmlFor="pname" className="sr-only">
        שם תצוגה
      </label>
      <input id="pname" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={24} required autoComplete="nickname" placeholder="שם או כינוי" aria-describedby="pname-hint" />
      <button className="btn btn-big" disabled={busy}>
        {busy ? "שותלים…" : <><Icon name="sprout" /> לשתול את העץ שלי</>}
      </button>
      <p id="pname-hint" className="hint">
        בלי טלפון, בלי מייל, בלי סיסמה
      </p>
      <ErrorLine text={error} />
    </form>
  );

  if (phone)
    return (
      <>
        <section className="phone-home">
          <Scene
            nodes={sample}
            votedAt={(i) => sampleVoted.has(i)}
            label="עץ של פתקי הצבעה שצומח מתוך קלפי, על גבעות ירושלים: פתקים בתכלת הצטרפו, פתקי זהב הצביעו"
            levelIndex={3}
            showNames={false}
            ballots={sampleVoted.size}
            stamps={{ voted: true }}
            crown={0.62}
            insetBottom={dockH}
            className="phone-scene"
          />
          <div className="phone-home-copy">
            <p className="chip">
              <Icon name="ballot" /> בחירות לכנסת · {ELECTION_DATE_LABEL}
            </p>
            <h1 className="title">
              עץ
              <br />
              ההצבעה
            </h1>
          </div>
          <div className="phone-dock" ref={dock}>
            {inviter && (
              <p className="gift">
                <Icon name="gift" /> קיבלת שתיל מ־<strong>{inviter}</strong>
              </p>
            )}
            <p className="phone-pitch">מזמינים חברים, וביום הבחירות כל מי שהצביע הופך לפתק זהב בכל העצים שמעליו</p>
            {joinForm}
          </div>
        </section>
        <section className="container page phone-more">
          <PulseBar p={pulse} />
          <ol className="levels-intro" aria-label="איך משחקים">
            <li>
              <span className="stage-n">שלב 1 · עכשיו</span>
              <h3>שותלים ומשקים</h3>
              <p>טיפה ביום שומרת אותו ירוק</p>
            </li>
            <li>
              <span className="stage-n">שלב 2 · עד הבחירות</span>
              <h3>מזמינים ומתחרים</h3>
              <p>כל חבר שמצטרף הוא ענף. ליגה פרטית עם החבר׳ה, ויש גם ליגה ארצית.</p>
            </li>
            <li className="gold">
              <span className="stage-n">שלב 3 · יום הבחירות</span>
              <h3>מזהיבים</h3>
              <p>מצביעים, לוחצים &quot;הצבעתי&quot;, וחבר שהיה שם מחתים חותמת עד.</p>
            </li>
          </ol>
          <div className="panel">
            <h2>
              <Icon name="drop" /> טיפות
            </h2>
            <DropsTable />
            <p className="hint">הטיפות סמליות: אין פרסים, אין הגרלות ואין שום תמורה</p>
          </div>
          <Link className="btn btn-ghost" href="/demo">
            <Icon name="play" /> יום בחירות שלם בחצי דקה
          </Link>
        </section>
      </>
    );

  return (
    <>
      <section className="stage">
        <Scene
          nodes={sample}
          votedAt={(i) => sampleVoted.has(i)}
          label="עץ של פתקי הצבעה שצומח מתוך קלפי, על גבעות ירושלים: פתקים צבעוניים הצטרפו, פתקי זהב הצביעו"
          levelIndex={3}
          showNames={false}
          ballots={sampleVoted.size}
          stamps={{ voted: true }}
          crown={0.66}
          className="stage-scene"
        />
        <div className="stage-copy container">
          <p className="chip"><Icon name="ballot" /> בחירות לכנסת ה־26 · יום שלישי, {ELECTION_DATE_LABEL}</p>
          <h1 className="title">
            עץ
            <br />
            ההצבעה
          </h1>
          <p className="verse">כִּי הָאָדָם עֵץ הַשָּׂדֶה</p>
        </div>
      </section>

      <section className="container join-wrap">
        <div className="join-col">
          <p className="lead">שותלים עץ שצומח מתוך קלפי, מזמינים חברים, וביום הבחירות כל מי שהצביע הופך לפתק זהב בכל העצים שמעליו.</p>
          {inviter && (
            <p className="gift">
              <span aria-hidden="true"><Icon name="gift" /></span> קיבלת שתיל מ־<strong>{inviter}</strong>. ההצטרפות מחברת אותך לעץ של {inviter}
            </p>
          )}
          {!data ? (
            <Loading />
          ) : data.me ? (
            <div className="panel join">
              <h2>העץ שלך כבר שתול</h2>
              <Link className="btn btn-big" href="/tree">
                <Icon name="tree" /> לעץ שלי
              </Link>
            </div>
          ) : (
            <form className="panel join" onSubmit={join}>
              <h2>איך לקרוא לך בעץ?</h2>
              <label htmlFor="name" className="sr-only">
                שם תצוגה
              </label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={24} required autoComplete="nickname" placeholder="שם או כינוי" aria-describedby="name-hint" />
              <button className="btn btn-big" disabled={busy}>
                {busy ? "שותלים…" : <><Icon name="sprout" /> לשתול את העץ שלי</>}
              </button>
              <p id="name-hint" className="hint">
                בלי טלפון, בלי מייל, בלי סיסמה
              </p>
              <ErrorLine text={error} />
            </form>
          )}
          <PulseBar p={pulse} />
        </div>

        <ol className="levels-intro" aria-label="איך משחקים">
          <li>
            <span className="stage-n">שלב 1 · עכשיו</span>
            <h3>שותלים ומשקים</h3>
            <p>טיפה ביום שומרת אותו ירוק</p>
          </li>
          <li>
            <span className="stage-n">שלב 2 · עד הבחירות</span>
            <h3>מזמינים ומתחרים</h3>
            <p>כל חבר שמצטרף הוא ענף. ליגה פרטית עם החבר׳ה, ויש גם ליגה ארצית.</p>
          </li>
          <li className="gold">
            <span className="stage-n">שלב 3 · יום הבחירות</span>
            <h3>מזהיבים</h3>
            <p>מצביעים, לוחצים &quot;הצבעתי&quot;, וחבר שהיה שם מחתים חותמת עד.</p>
          </li>
        </ol>
      </section>

      <section className="container duo">
        <div className="panel">
          <h2><Icon name="drop" /> טיפות</h2>
          <DropsTable />
          <p className="hint">הטיפות סמליות: אין פרסים, אין הגרלות ואין שום תמורה</p>
        </div>
        <div className="panel">
          <h2><Icon name="tree" /> עצים לאסוף</h2>
          <ul className="species-row">
            {SPECIES.map((s) => (
              <li key={s.id}>
                <LeafChip species={s.id} size={44} />
                <b>{s.name}</b>
                <span>{LEVELS[s.level].name}</span>
              </li>
            ))}
          </ul>
          <p className="hint">כל דרגה פותחת עץ חדש ומוסיפה לנוף כלניות, פרפרים, דוכיפת וחורשה</p>
          <Link className="btn btn-ghost" href="/demo">
            <Icon name="play" /> יום בחירות שלם בעשרים שניות
          </Link>
        </div>
      </section>
    </>
  );
}

// ---------- my tree ----------

type Plan = { when: string; how: string; with: string; checked: boolean; id: boolean };
const loadPlan = (): Plan | null => {
  try {
    return JSON.parse(localStorage.getItem("vt_plan") ?? "null");
  } catch {
    return null;
  }
};

function Hud({ me, data, onWater }: { me: Me; data: MeResponse; onWater: () => void }) {
  const lv = level(me.points);
  const [busy, setBusy] = useState(false);
  const canWater = data.phase !== "after";
  async function water() {
    setBusy(true);
    const r = await api.water().catch(() => null);
    setBusy(false);
    if (r && !r.already) celebrate("green");
    onWater();
  }
  return (
    <div className="hud">
      <div className="emblem" aria-hidden="true">
        <Icon name={lv.icon} size={30} />
      </div>
      <div className="hud-main">
        <p className="hud-name">{me.name}</p>
        <p className="hud-level">
          <b>{lv.name}</b>
        </p>
        {lv.next ? (
          <div className="xp" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(lv.progress * 100)} aria-label={`עוד ${lv.next.at - me.points} טיפות ל${lv.next.name}`}>
            <span style={{ width: `${Math.max(4, Math.round(lv.progress * 100))}%` }} />
            <em>
              <Icon name="drop" size={11} /> <bdi dir="ltr">{me.points} / {lv.next.at}</bdi> · {lv.next.name}
            </em>
          </div>
        ) : (
          <p className="hud-level">
            <Icon name="drop" size={12} /> {me.points} · הדרגה הגבוהה ביותר
          </p>
        )}
      </div>
      {data.phase === "before" && (
        <p className="hud-countdown">
          <Icon name="ballot" size={14} /> עוד <b>{data.daysUntil}</b> ימים לבחירות · {ELECTION_DATE_LABEL}
        </p>
      )}
      {canWater && (
        <button className={`water ${me.wateredToday ? "done" : ""}`} onClick={water} disabled={busy || me.wateredToday} aria-label={me.wateredToday ? `הושקה היום. רצף: ${me.stats.streak} ימים` : "השקיה יומית, טיפה אחת"}>
          <Icon name={me.wateredToday ? "check" : "drop"} size={20} />
          <span>{me.wateredToday ? "הושקה היום" : "להשקות"}</span>
          <span className="streak" aria-hidden="true">
            <Icon name="flame" size={14} /> {me.stats.streak}
          </span>
        </button>
      )}
    </div>
  );
}

function waHref(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function WaLink({ text, label, small = false, ghost = false }: { text: string; label: string; small?: boolean; ghost?: boolean }) {
  return (
    <a className={`btn ${ghost ? "btn-ghost" : "btn-wa"} ${small ? "btn-small" : ""}`} href={waHref(text)} target="_blank" rel="noopener noreferrer">
      <Icon name="chat" /> {label}
    </a>
  );
}

function VoteCard({ data, onVoted }: { data: MeResponse; onVoted: () => void }) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [copied, copy] = useCopy();
  const me = data.me!;
  const plan = loadPlan();
  async function vote() {
    try {
      await api.vote();
      celebrate("gold");
      onVoted();
    } catch (e) {
      setError(errorText(e));
    }
  }
  if (me.stats.voted) {
    const link = me.confirmCode ? `${location.origin}/c/${me.confirmCode}` : "";
    return (
      <Slip className="slip-done">
        <p className="slip-big">
          <Icon name="check" /> הפתק בקלפי
        </p>
        <p className="hint">סימון לבד שווה טיפה אחת</p>
        <div className="proofs">
          <div className={`proof ${me.confirmedBy ? "done" : ""}`}>
            <p className="proof-h">
              <Icon name="stamp" /> חותמת עד <span className="q-reward">+{POINTS.confirmed}</span>
            </p>
            {me.confirmedBy ? (
              <p>
                החותמת של <b>{me.confirmedBy}</b>
              </p>
            ) : (
              me.confirmCode && (
                <div className="row">
                  <WaLink text={`הצבעתי. היית איתי? החותמת שלך על הפתק שלי: ${link}`} label="לבקש חותמת" small />
                  <button className="btn-link" onClick={() => copy(link)}>
                    {copied ? "הועתק" : "העתקת הקישור"}
                  </button>
                </div>
              )
            )}
          </div>
          <PhotoProof me={me} open={data.phase === "open"} onChange={onVoted} />
        </div>
      </Slip>
    );
  }
  if (data.phase === "before") return null; // the countdown lives in the HUD
  if (data.phase === "after")
    return (
      <Slip>
        <p className="slip-big">הקלפיות נסגרו</p>
        <p>תודה שהיית חלק מהיער</p>
      </Slip>
    );
  return (
    <Slip className="slip-open">
      <p className="slip-big">היום בוחרים</p>
      {plan && (
        <p>
          התוכנית שלך: {plan.when}, {plan.how}, {plan.with}
        </p>
      )}
      {!asking ? (
        <button className="btn btn-gold" onClick={() => setAsking(true)}>
          <Icon name="ballot" /> הצבעתי
        </button>
      ) : (
        <div className="confirm">
          <p>לאשר שהצבעת היום? לא שואלים למי, ולא שומרים.</p>
          <div className="row">
            <button className="btn btn-gold" onClick={vote}>
              כן, הצבעתי
            </button>
            <button className="btn-link" onClick={() => setAsking(false)}>
              עוד לא
            </button>
          </div>
        </div>
      )}
      <ErrorLine text={error} />
    </Slip>
  );
}

function PhotoProof({ me, open, onChange }: { me: Me; open: boolean; onChange: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      await api.uploadPhoto(await preparePhoto(f));
      celebrate("gold");
      onChange();
    } catch (err) {
      setError(errorText(err));
    }
    setBusy(false);
  }
  const ph = me.photo;
  return (
    <div className={`proof ${ph && !ph.hidden ? "done" : ""}`}>
      <p className="proof-h">
        <Icon name="camera" /> תמונה מהקלפי <span className="q-reward">+{POINTS.photo}</span>
      </p>
      {ph?.hidden ? (
        <p className="hint">חברי הליגה סימנו שזו לא תמונה מקלפי, והטיפות ירדו</p>
      ) : ph ? (
        <>
          <img className="proof-img" src={api.photoUrl(ph.token)} alt="התמונה שלך מהקלפי" />
          <p className="hint">רק חברי הליגות שלך רואים אותה, והיא נמחקת כשהקלפיות נסגרות</p>
          {open && (
            <button className="btn-link" onClick={() => api.deletePhoto().then(onChange)}>
              מחיקת התמונה
            </button>
          )}
        </>
      ) : open ? (
        <>
          <p className="hint">מבחוץ: השלט של הקלפי, הכניסה, את או אתה ליד. בלי הפתק, בלי הפרגוד ובלי אנשים אחרים.</p>
          <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
          <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => input.current?.click()}>
            <Icon name="camera" /> {busy ? "מעלים…" : "צילום"}
          </button>
        </>
      ) : null}
      <ErrorLine text={error} />
    </div>
  );
}

function SeedsCard({ me, primary }: { me: Me; primary: boolean }) {
  const url = `${location.origin}/j/${me.code}`;
  const [copied, copy] = useCopy();
  const [card, setCard] = useState("");
  const text = `שתלתי עץ לקראת הבחירות. מצטרפים דרך הקישור שלי, וב־${ELECTION_DATE_LABEL} כל מי שמצביע הופך לפתק זהב: ${url}`;
  async function story() {
    const svg = document.querySelector<HTMLDivElement>(".world .scene");
    const canvas = svg?.querySelector("canvas");
    if (!canvas) return;
    setCard("…");
    const s = me.stats;
    const gold = s.totalVoted + (s.voted ? 1 : 0);
    const blob = await storyCard(canvas, {
      title: "עץ ההצבעה",
      sub: `העץ של ${me.name} · ${level(me.points).name}`,
      big: gold > 0 ? `${gold} פתקי זהב` : `${s.totalJoined + 1} בעץ`,
      link: url.replace(/^https?:\/\//, ""),
    });
    const how = await shareOrDownload(blob, "vote-tree.png", text);
    setCard(how === "downloaded" ? "התמונה ירדה" : "");
  }
  return (
    <section className="panel seeds" aria-labelledby="seeds-h">
      <h2 id="seeds-h">
        <Icon name="sprout" /> להזמין חברים
      </h2>
      <p className="hint">כל מי שמצטרף דרך הקישור שלך הופך לענף בעץ שלך</p>
      <button className="link-copy" dir="ltr" onClick={() => copy(url)}>
        {url.replace(/^https?:\/\//, "")}
        <span>{copied ? "הועתק" : "העתקת הקישור"}</span>
      </button>
      <div className="row">
        <WaLink text={text} label="שליחה בוואטסאפ" ghost={!primary} />
        <button className="btn-link" onClick={story} disabled={card === "…"}>
          <Icon name="camera" /> {card || "תמונה לסטורי"}
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {copied ? "הקישור הועתק" : card}
      </p>
    </section>
  );
}

function PlanDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const old = loadPlan();
  const [plan, setPlan] = useState<Plan>(old ?? { when: "בבוקר", how: "ברגל", with: "לבד", checked: false, id: false });
  const [busy, setBusy] = useState(false);
  const pick = (k: "when" | "how" | "with", opts: string[], legend: string) => (
    <fieldset className="choices">
      <legend>{legend}</legend>
      {opts.map((o) => (
        <label key={o} className={plan[k] === o ? "on" : ""}>
          <input type="radio" name={k} value={o} checked={plan[k] === o} onChange={() => setPlan({ ...plan, [k]: o })} />
          {o}
        </label>
      ))}
    </fieldset>
  );
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      localStorage.setItem("vt_plan", JSON.stringify(plan));
    } catch {
      /* the plan just won't be remembered on this device */
    }
    await api.plan().catch(() => {});
    setBusy(false);
    if (!old) celebrate("green");
    onSaved();
    onClose();
  }
  return (
    <Modal open={open} onClose={onClose} label="תוכנית הצבעה">
      <form className="plan" onSubmit={save}>
        <h2>
          <Icon name="map" /> תוכנית הצבעה
        </h2>
        <p className="hint">נשמרת רק בטלפון הזה</p>
        {pick("when", ["בבוקר", "בצהריים", "אחרי העבודה"], "מתי?")}
        {pick("how", ["ברגל", "ברכב", "בתחבורה ציבורית"], "איך מגיעים?")}
        {pick("with", ["לבד", "עם המשפחה", "עם חברים"], "עם מי?")}
        <label className="check">
          <input type="checkbox" checked={plan.checked} onChange={(e) => setPlan({ ...plan, checked: e.target.checked })} />
          <span>
            בדקתי איפה הקלפי שלי (
            <a href={POLL_LOOKUP} target="_blank" rel="noopener noreferrer">
              באתר ועדת הבחירות
            </a>
            )
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={plan.id} onChange={(e) => setPlan({ ...plan, id: e.target.checked })} />
          <span>תעודה מזהה עם תמונה: תעודת זהות, דרכון או רישיון נהיגה</span>
        </label>
        <div className="row">
          <button className="btn" disabled={busy}>
            {old ? "שמירה" : `שמירה · +${POINTS.plan} טיפות`}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => download(voteIcs(plan, POLL_LOOKUP), "election-day.ics")}>
            <Icon name="calendar" /> ליומן
          </button>
          <button type="button" className="btn-link" onClick={onClose}>
            ביטול
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Quests({ me, phase, onPlan }: { me: Me; phase: MeResponse["phase"]; onPlan: () => void }) {
  const s = me.stats;
  type Q = { icon: string; title: string; sub: string; reward: number | null; done: boolean; progress?: [number, number]; action?: ReactNode };
  const quests: Q[] = [
    { icon: "drop", title: "שבוע של השקיה", sub: "טיפה ביום, שבעה ימים ברצף", reward: 7, done: s.streak >= 7, progress: [Math.min(7, s.streak), 7] },
    {
      icon: "map",
      title: "תוכנית הצבעה",
      sub: "מתי, איך ועם מי",
      reward: POINTS.plan,
      done: s.planned,
      action: (
        <button className="btn btn-ghost btn-small" onClick={onPlan}>
          לתכנן
        </button>
      ),
    },
    { icon: "sprout", title: "שלושה ענפים", sub: "3 חברים מצטרפים דרכך", reward: 3, done: s.directJoined >= 3, progress: [Math.min(3, s.directJoined), 3] },
    {
      icon: "league",
      title: "ליגה עם החבר׳ה",
      sub: "ליגה פרטית משלך או של חברים",
      reward: null,
      done: s.leagues >= 1,
      action: (
        <Link className="btn btn-ghost btn-small" href="/leagues">
          לליגות
        </Link>
      ),
    },
    { icon: "generations", title: "דור שלישי", sub: "חבר של חבר של חבר", reward: null, done: s.depth >= 3, progress: [Math.min(3, s.depth), 3] },
  ];
  // Election-day quests only on the day, and only until they're done in the vote card.
  if (phase === "open" && !s.voted) quests.push({ icon: "ballot", title: "הצבעתי", sub: "היום", reward: POINTS.selfVoted, done: false });
  const open = quests.filter((q) => !q.done);
  const done = quests.filter((q) => q.done);
  const row = (q: Q) => (
    <li key={q.title} className={q.done ? "done" : ""}>
      <span className="q-icon" aria-hidden="true">
        <Icon name={q.done ? "check" : q.icon} />
      </span>
      <span className="q-text">
        <b>{q.title}</b>
        <span>{q.sub}</span>
        {q.progress && !q.done && (
          <span className="q-bar" role="img" aria-label={`${q.progress[0]} מתוך ${q.progress[1]}`}>
            <span style={{ width: `${(q.progress[0] / q.progress[1]) * 100}%` }} />
          </span>
        )}
      </span>
      {q.reward != null && <span className="q-reward">+{q.reward}</span>}
      {!q.done && q.action}
    </li>
  );
  return (
    <section className="panel quests" aria-labelledby="q-h">
      <h2 id="q-h">
        <Icon name="sparkle" /> משימות
      </h2>
      <ul>{open.map(row)}</ul>
      {phase === "before" && <p className="quest-group">ביום הבחירות: הצבעתי (+{POINTS.selfVoted}), חותמת עד (+{POINTS.confirmed}), תמונה מהקלפי (+{POINTS.photo})</p>}
      {done.length > 0 && (
        <details>
          <summary>הושלמו ({done.length})</summary>
          <ul>{done.map(row)}</ul>
        </details>
      )}
    </section>
  );
}

function Nudges({ me }: { me: Me }) {
  const waiting = me.tree.filter((n) => n.p === 0 && !n.v && n.n);
  if (waiting.length === 0) return null;
  return (
    <section className="panel nudges" aria-labelledby="n-h">
      <h2 id="n-h">
        <Icon name="megaphone" /> עוד לא הצביעו
      </h2>
      <ul>
        {waiting.slice(0, 12).map((n) => (
          <li key={n.i}>
            <span>{n.n}</span>
            <WaLink text={`היי ${n.n}, כבר הצבעת? הפתק שלך בעץ ההצבעה עוד מחכה להזהיב ${location.origin}/tree`} label="תזכורת" small ghost />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SpeciesPicker({ me, onChanged }: { me: Me; onChanged: () => void }) {
  const lv = level(me.points).index;
  const [error, setError] = useState("");
  const unlocked = SPECIES.filter((s) => lv >= s.level).length;
  return (
    <details>
      <summary>
        העצים שלי · {unlocked} מתוך {SPECIES.length} פתוחים
      </summary>
      <ul className="species-grid">
        {SPECIES.map((s) => {
          const open = lv >= s.level;
          const on = me.species === s.id;
          return (
            <li key={s.id}>
              <button
                className={`species ${on ? "on" : ""} ${open ? "" : "locked"}`}
                disabled={!open || on}
                aria-pressed={on}
                onClick={() =>
                  api
                    .species(s.id)
                    .then(onChanged)
                    .catch((e) => setError(errorText(e)))
                }
              >
                <LeafChip species={s.id} size={44} />
                <b>{s.name}</b>
                {!open && (
                  <span>
                    <Icon name="lock" size={11} /> {LEVELS[s.level].name}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <ErrorLine text={error} />
    </details>
  );
}

function Badges({ me }: { me: Me }) {
  const earned = ACHIEVEMENTS.filter((a) => a.done(me.stats));
  const locked = ACHIEVEMENTS.filter((a) => !a.done(me.stats));
  return (
    <section aria-labelledby="b-h" className="badges">
      <h2 id="b-h">
        <Icon name="medal" /> תגים · {earned.length}
      </h2>
      <ul>
        {earned.map((a) => (
          <li key={a.id} className="badge">
            <span className="medal" aria-hidden="true">
              <Icon name={a.icon} size={26} />
            </span>
            <b>{a.title}</b>
            <span>{a.hint}</span>
          </li>
        ))}
      </ul>
      {locked.length > 0 && (
        <details>
          <summary>עוד {locked.length} תגים</summary>
          <ul>
            {locked.map((a) => (
              <li key={a.id}>
                <b>{a.title}</b>: {a.hint}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function AccountCard({ k, onGone }: { k: string; onGone: () => void }) {
  const [copied, copy] = useCopy();
  const [leaving, setLeaving] = useState(false);
  return (
    <details className="account">
      <summary>
        <Icon name="key" /> הקישור הפרטי וחשבון
      </summary>
      <p>זו הדרך היחידה להיכנס לעץ שלך ממכשיר אחר. כדאי לשמור אותו אצלך ולא לשלוח לאף אחד.</p>
      <div className="row">
        <button className="btn btn-ghost" onClick={() => copy(`${location.origin}/restore#${k}`)}>
          {copied ? "הועתק" : "העתקת הקישור הפרטי"}
        </button>
        <button className="btn-link" onClick={() => api.logout().then(onGone)}>
          יציאה מהמכשיר הזה
        </button>
      </div>
      <details className="leave">
        <summary>מחיקת השם שלי מהעץ</summary>
        <p>המקום שלך נשאר כדי שמי שהזמנת לא יאבד את העץ שלו, אבל השם שלך יימחק, הליגות שלך יתרוקנו ממך והקישורים שלך יפסיקו לעבוד. אי אפשר לבטל.</p>
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
    </details>
  );
}

function useLevelUps(me: Me | null | undefined) {
  const [shown, setShown] = useState<null | { kind: "welcome" | "up"; index: number }>(null);
  useEffect(() => {
    if (!me) return;
    const idx = level(me.points).index;
    const key = `vt_lvl_${me.code}`;
    let seen: number | null = null;
    try {
      const raw = localStorage.getItem(key);
      seen = raw == null ? null : Number(raw);
      localStorage.setItem(key, String(idx));
    } catch {
      /* no storage: no level-up moments */
    }
    if (sessionStorage.getItem("vt_welcome")) {
      sessionStorage.removeItem("vt_welcome");
      setShown({ kind: "welcome", index: idx });
      celebrate("green");
    } else if (seen != null && idx > seen) {
      setShown({ kind: "up", index: idx });
      celebrate("gold");
    }
  }, [me]);
  return [shown, () => setShown(null)] as const;
}


// ---------- the phone: a full-screen game ----------

type SheetId = "invite" | "vote" | "quests" | "badges" | "more" | null;

function PhoneGame({ data, reload, onPlan }: { data: MeResponse; reload: () => void; onPlan: () => void }) {
  const me = data.me!;
  const s = me.stats;
  const lv = level(me.points);
  const gold = s.totalVoted + (s.voted ? 1 : 0);
  const [sheet, setSheet] = useState<SheetId>(null);
  const [watering, setWatering] = useState(false);
  const dock = useRef<HTMLDivElement>(null);
  const [dockH, setDockH] = useState(0);
  useEffect(() => {
    const el = dock.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDockH(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const voting = data.phase === "open";
  const openQuests = [s.streak < 7, !s.planned, s.directJoined < 3, s.leagues < 1, s.depth < 3].filter(Boolean).length;
  const earned = ACHIEVEMENTS.filter((a) => a.done(s)).length;

  async function water() {
    if (me.wateredToday || data.phase === "after") return;
    setWatering(true);
    const r = await api.water().catch(() => null);
    setWatering(false);
    if (r && !r.already) celebrate("green");
    reload();
  }

  // The one big action changes with the day.
  const cta =
    voting && !s.voted
      ? { label: "הצבעתי", icon: "ballot", cls: "btn-gold", go: () => setSheet("vote") }
      : s.voted && data.phase !== "after"
        ? { label: "חותמת עד ותמונה", icon: "stamp", cls: "", go: () => setSheet("vote") }
        : { label: "להזמין חברים", icon: "sprout", cls: "", go: () => setSheet("invite") };

  return (
    <div className="phone-game">
      <Scene
        className="phone-scene"
        nodes={me.tree}
        species={me.species}
        levelIndex={lv.index}
        ghosts={Math.max(0, 3 - s.directJoined)}
        ballots={gold}
        stamps={{ voted: s.voted, witnessed: s.confirmed }}
        insetBottom={dockH}
        label={`העץ של ${me.name}: ${s.totalJoined} אנשים, ${gold} פתקי זהב`}
      />

      <div className="phone-hud">
        <button className="hud-chip hud-level" onClick={() => setSheet("badges")} aria-label={`דרגה ${lv.name}, ${me.points} טיפות`}>
          <Icon name={lv.icon} size={16} />
          <b>{lv.name}</b>
          {lv.next && (
            <span className="hud-meter" aria-hidden="true">
              <span style={{ width: `${Math.max(6, Math.round(lv.progress * 100))}%` }} />
            </span>
          )}
        </button>
        <span className="hud-chip">
          <Icon name="drop" size={14} /> {me.points}
        </span>
        <span className="hud-chip">
          <Icon name="flame" size={14} /> {s.streak}
        </span>
        <span className={`hud-chip ${voting ? "hud-today" : ""}`}>
          <Icon name="ballot" size={14} /> {data.phase === "before" ? `עוד ${data.daysUntil} ימים` : voting ? "היום" : "נגמר"}
        </span>
      </div>

      {s.totalJoined > 0 && (
        <p className="phone-tally">
          <b>{s.totalJoined}</b> בעץ · <b className="gold-n">{gold}</b> זהב
        </p>
      )}

      <div className="phone-dock" ref={dock}>
        <div className="fabs">
          <button className={`fab ${me.wateredToday ? "done" : ""}`} onClick={water} disabled={watering || data.phase === "after"}>
            <span className="fab-icon">
              <Icon name={me.wateredToday ? "check" : "drop"} size={22} />
            </span>
            <span>{me.wateredToday ? "הושקה" : "השקיה"}</span>
          </button>
          <button className="fab" onClick={() => setSheet("quests")}>
            <span className="fab-icon">
              <Icon name="sparkle" size={22} />
              {openQuests > 0 && <i className="fab-badge">{openQuests}</i>}
            </span>
            <span>משימות</span>
          </button>
          <button className="fab" onClick={() => setSheet("badges")}>
            <span className="fab-icon">
              <Icon name="medal" size={22} />
            </span>
            <span>תגים · {earned}</span>
          </button>
          {cta.label !== "להזמין חברים" && (
            <button className="fab" onClick={() => setSheet("invite")}>
              <span className="fab-icon">
                <Icon name="sprout" size={22} />
              </span>
              <span>הזמנה</span>
            </button>
          )}
          <button className="fab" onClick={() => setSheet("more")}>
            <span className="fab-icon">
              <Icon name="key" size={22} />
            </span>
            <span>חשבון</span>
          </button>
        </div>
        <button className={`btn btn-big cta ${cta.cls}`} onClick={cta.go}>
          <Icon name={cta.icon} size={22} /> {cta.label}
        </button>
      </div>

      <Sheet open={sheet === "invite"} onClose={() => setSheet(null)} title="להזמין חברים">
        <SeedsCard me={me} primary />
        {voting && <Nudges me={me} />}
      </Sheet>
      <Sheet open={sheet === "vote"} onClose={() => setSheet(null)} title={s.voted ? "הוכחות" : "היום בוחרים"}>
        <VoteCard
          data={data}
          onVoted={() => {
            reload();
          }}
        />
        {voting && <Nudges me={me} />}
      </Sheet>
      <Sheet open={sheet === "quests"} onClose={() => setSheet(null)} title="משימות">
        <Quests me={me} phase={data.phase} onPlan={() => { setSheet(null); onPlan(); }} />
      </Sheet>
      <Sheet open={sheet === "badges"} onClose={() => setSheet(null)} title={`${lv.name} · ${me.points} טיפות`}>
        {lv.next && (
          <p className="hint">
            עוד <bdi dir="ltr">{lv.next.at - me.points}</bdi> טיפות ל{lv.next.name}
          </p>
        )}
        <Badges me={me} />
        <SpeciesPicker me={me} onChanged={reload} />
      </Sheet>
      <Sheet open={sheet === "more"} onClose={() => setSheet(null)} title="חשבון">
        <AccountCard k={me.key} onGone={() => navigate("/", true)} />
      </Sheet>
    </div>
  );
}

export function MyTree() {
  const { data, reload } = useMe();
  const phone = useIsPhone();
  const [planOpen, setPlanOpen] = useState(false);
  const [moment, closeMoment] = useLevelUps(data?.me);
  useEffect(() => {
    if (data && !data.me) navigate("/", true);
  }, [data]);
  if (!data?.me)
    return (
      <div className="container page">
        <Loading />
      </div>
    );

  const me = data.me;
  const s = me.stats;
  const lv = level(me.points);
  const gold = s.totalVoted + (s.voted ? 1 : 0);
  const unlocked = moment ? SPECIES.find((sp) => sp.level === moment.index) : undefined;
  const voting = data.phase === "open";

  const dialogs = (
    <>
      <PlanDialog open={planOpen} onClose={() => setPlanOpen(false)} onSaved={reload} />
      <Modal open={!!moment} onClose={closeMoment} label={moment?.kind === "welcome" ? "העץ נשתל" : "דרגה חדשה"}>
        {moment && (
          <div className="moment">
            <div className="emblem emblem-big" aria-hidden="true">
              <Icon name={LEVELS[moment.index].icon} size={54} />
            </div>
            {moment.kind === "welcome" ? (
              <>
                <h2>שתלת עץ בקלפי!</h2>
                <p>שלושה פתקים מקווקווים מחכים לחברים הראשונים שלך. מחר משקים שוב.</p>
                <p className="hint">הקישור הפרטי לחזרה מכל מכשיר נמצא ב&quot;חשבון&quot;</p>
              </>
            ) : (
              <>
                <h2>עלית דרגה: {LEVELS[moment.index].name}</h2>
                {unlocked && <p>נפתח עץ חדש: {unlocked.name}, ב&quot;העצים שלי&quot;</p>}
              </>
            )}
            <button className="btn btn-big" onClick={closeMoment}>
              יאללה
            </button>
          </div>
        )}
      </Modal>
    </>
  );

  if (phone)
    return (
      <>
        <PhoneGame data={data} reload={reload} onPlan={() => setPlanOpen(true)} />
        {dialogs}
      </>
    );

  return (
    <div className="container game">
      <Hud me={me} data={data} onWater={reload} />

      <div className="game-grid">
        {/* the actions come first on a phone: invite before the day, vote on the day */}
        <div className="game-side">
          {voting && <VoteCard data={data} onVoted={reload} />}
          {voting && <Nudges me={me} />}
          {!voting && s.voted && <VoteCard data={data} onVoted={reload} />}
          <SeedsCard me={me} primary={!voting || s.voted} />
        </div>

        <figure className="world">
          <Scene
            nodes={me.tree}
            species={me.species}
            levelIndex={lv.index}
            ghosts={Math.max(0, 3 - s.directJoined)}
            ballots={gold}
            stamps={{ voted: s.voted, witnessed: s.confirmed }}
            label={`העץ של ${me.name}: ${s.totalJoined} אנשים, ${gold} פתקי זהב`}
          />
          <figcaption>
            {s.totalJoined === 0 ? (
              <>הפתקים המקווקווים מחכים לחברים שלך</>
            ) : (
              <>
                <b>{s.directJoined}</b> הצטרפו דרכך · <b>{s.totalJoined}</b> בכל העץ · <b className="gold-n">{gold}</b> פתקי זהב
                {me.treeTruncated ? " · מוצגים 400 הראשונים" : ""}
              </>
            )}
          </figcaption>
        </figure>

        <div className="game-quests">
          <Quests me={me} phase={data.phase} onPlan={() => setPlanOpen(true)} />
        </div>
      </div>

      <div className="game-lower">
        <Badges me={me} />
        <SpeciesPicker me={me} onChanged={reload} />
        <AccountCard k={me.key} onGone={() => navigate("/", true)} />
      </div>

      {dialogs}
    </div>
  );
}

// ---------- leagues ----------

function Table({ rows, start = 1, onPhoto }: { rows: Leader[]; start?: number; onPhoto?: (r: Leader) => void }) {
  return (
    <ol className="ranks" start={start}>
      {rows.map((r, k) => (
        <li key={k} className={r.me ? "me" : ""}>
          <span className="r-n">{k + start}</span>
          <LeafChip species={r.species} size={30} gold={r.voted > 0} />
          <b>
            {r.name}
            {r.me && <span className="you"> (אני)</span>}
          </b>
          <span className="r-meta">
            <Icon name={level(r.points).icon} size={11} /> {r.joined} בעץ · {r.voted} זהב
          </span>
          <span className="drops"><Icon name="drop" /> {r.points}</span>
          {r.photo && onPhoto && (
            <button className="btn btn-ghost btn-small photo-btn" onClick={() => onPhoto(r)} aria-label={`התמונה של ${r.name} מהקלפי`}>
              <Icon name="camera" />
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

function Podium({ rows, onPhoto }: { rows: Leader[]; onPhoto?: (r: Leader) => void }) {
  const p = rows.slice(0, 3);
  const order = [p[1], p[0], p[2]];
  return (
    <ol className="podium" aria-label="שלושת הראשונים">
      {order.map((r, k) =>
        r ? (
          <li key={k} className={`p${k === 1 ? 1 : k === 0 ? 2 : 3}${r.me ? " me" : ""}`}>
            <span className="p-medal" aria-hidden="true">
              {k === 1 ? 1 : k === 0 ? 2 : 3}
            </span>
            <LeafChip species={r.species} size={k === 1 ? 72 : 56} gold={r.voted > 0} />
            <b>{r.name}</b>
            <span>
              <Icon name={level(r.points).icon} size={11} /> {level(r.points).name} · <Icon name="drop" /> {r.points}
            </span>
            {r.photo && onPhoto && (
              <button className="btn btn-ghost btn-small photo-btn" onClick={() => onPhoto(r)} aria-label={`התמונה של ${r.name} מהקלפי`}>
                <Icon name="camera" />
              </button>
            )}
            <span className="p-block" />
          </li>
        ) : (
          <li key={k} className="p-empty" aria-hidden="true" />
        ),
      )}
    </ol>
  );
}

export function Leagues() {
  const { data, reload } = useMe();
  const pulse = usePulse();
  const [rows, setRows] = useState<Leader[] | null>(null);
  const [name, setName] = useState("");
  const [join, setJoin] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .leaders()
      .then((r) => setRows(r.leaders))
      .catch(() => setRows([]));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const r = await api.createLeague(name);
      celebrate("green");
      if (r.code) navigate(`/l/${r.code}`);
    } catch (err) {
      setError(errorText(err));
    }
  }
  function goJoin(e: FormEvent) {
    e.preventDefault();
    const code = join.trim().split("/").pop()?.toLowerCase() ?? "";
    if (code) navigate(`/l/${code}`);
  }

  return (
    <div className="container page">
      <h1>מי מגדל את העץ הכי זהוב?</h1>
      <p className="hint">טבלה ארצית לכולם, וליגות פרטיות רק למי שקיבל את הקישור</p>
      <PulseBar p={pulse} />

      <div className="duo leagues-top">
        <section className="panel" aria-labelledby="mine-h">
          <h2 id="mine-h"><Icon name="league" /> הליגות שלי</h2>
          {!data ? (
            <Loading />
          ) : !data.me ? (
            <p>
              ליגות פרטיות הן לבעלי עץ. <Link href="/">לשתול עץ</Link>
            </p>
          ) : (
            <>
              {data.me.leagues.length === 0 ? (
                <p className="hint">עוד אין. ליגה עם המשפחה, עם הקבוצה בעבודה, עם החבר׳ה מהצבא</p>
              ) : (
                <ul className="my-leagues">
                  {data.me.leagues.map((l) => (
                    <li key={l.code}>
                      <Link href={`/l/${l.code}`}>
                        <b>{l.name}</b> <span className="hint">{l.members} בליגה</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <form className="inline-form" onSubmit={create}>
                <label htmlFor="lname" className="sr-only">
                  שם הליגה
                </label>
                <input id="lname" value={name} onChange={(e) => setName(e.target.value)} placeholder="שם לליגה חדשה" minLength={2} maxLength={30} required />
                <button className="btn">יצירה</button>
              </form>
              <form className="inline-form" onSubmit={goJoin}>
                <label htmlFor="ljoin" className="sr-only">
                  קוד או קישור לליגה
                </label>
                <input id="ljoin" value={join} onChange={(e) => setJoin(e.target.value)} placeholder="קישור או קוד של ליגה" dir="ltr" />
                <button className="btn btn-ghost">הצטרפות</button>
              </form>
              <ErrorLine text={error} />
            </>
          )}
        </section>
      </div>

      <h2 className="section-h">
        <Icon name="flag" /> הליגה הארצית
      </h2>
      {!rows ? (
        <Loading />
      ) : rows.length === 0 ? (
        <p className="panel">הטבלה עוד ריקה. הטיפה הראשונה תפתח אותה.</p>
      ) : (
        <>
          <Podium rows={rows} />
          {rows.length > 3 && <Table rows={rows.slice(3)} start={4} />}
        </>
      )}
    </div>
  );
}

export function LeagueView({ code }: { code: string }) {
  const { data } = useMe();
  const [league, setLeague] = useState<League | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [copied, copy] = useCopy();
  const load = () => api.league(code).then(setLeague);
  useEffect(() => void load(), [code]);
  const [viewing, setViewing] = useState<Leader | null>(null);
  const [flagged, setFlagged] = useState(false);

  if (league === undefined)
    return (
      <div className="container page">
        <Loading />
      </div>
    );
  if (league === null)
    return (
      <div className="container page narrow">
        <h1>הליגה לא נמצאה</h1>
        <p>אולי הקישור הועתק חלקית?</p>
        <Link className="btn" href="/leagues">
          לליגות
        </Link>
      </div>
    );

  const url = `${location.origin}/l/${league.code}`;
  const text = `הצטרפות לליגה "${league.name}" בעץ ההצבעה. מי מגדל את העץ הכי זהוב עד ${ELECTION_DATE_LABEL}? ${url}`;
  async function joinIt() {
    setError("");
    try {
      await api.joinLeague(league!.code);
      celebrate("green");
      load();
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <div className="container page">
      <p className="chip"><Icon name="league" /> ליגה פרטית · של {league.owner}</p>
      <h1>{league.name}</h1>
      <div className="row league-actions">
        {!data ? null : !data.me ? (
          <>
            <p>כדי להצטרף צריך עץ.</p>
            <Link className="btn" href="/" onClick={() => sessionStorage.setItem("vt_after_join", `/l/${league.code}`)}>
              <Icon name="sprout" /> לשתול עץ ולהצטרף
            </Link>
          </>
        ) : league.isMember ? (
          <>
            <WaLink text={text} label="הזמנה בוואטסאפ" />
            <button className="btn btn-ghost" onClick={() => copy(url)}>
              {copied ? "הועתק" : "העתקת הקישור"}
            </button>
          </>
        ) : (
          <button className="btn btn-big" onClick={joinIt}>
            <Icon name="league" /> להצטרף לליגה
          </button>
        )}
      </div>
      <ErrorLine text={error} />
      {league.members.length > 0 && <Podium rows={league.members} onPhoto={setViewing} />}
      {league.members.length > 3 && <Table rows={league.members.slice(3)} start={4} onPhoto={setViewing} />}
      {league.isMember && (
        <button
          className="btn-link section-h"
          onClick={() =>
            api
              .leaveLeague(league.code)
              .then(load)
              .catch(() => {})
          }
        >
          יציאה מהליגה
        </button>
      )}
      <Modal open={!!viewing} onClose={() => { setViewing(null); setFlagged(false); }} label="תמונה מהקלפי">
        {viewing?.photo && (
          <div className="moment">
            <h2>
              <Icon name="camera" /> {viewing.name} בקלפי
            </h2>
            <img className="proof-img big" src={api.photoUrl(viewing.photo)} alt={`התמונה של ${viewing.name} מהקלפי`} />
            {viewing.me ? null : flagged ? (
              <p className="hint">סומן. שני סימונים מורידים את התמונה ואת הטיפות שלה</p>
            ) : (
              <button className="btn btn-ghost" onClick={() => api.flagPhoto(viewing.photo!).then(() => setFlagged(true)).catch(() => setFlagged(true))}>
                זו לא תמונה מקלפי
              </button>
            )}
            <p className="hint">התמונות נמחקות כשהקלפיות נסגרות.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------- the witness stamp ----------

export function WitnessPage({ code }: { code: string }) {
  const { data } = useMe();
  const [w, setW] = useState<Witness | null | undefined>(undefined);
  const [state, setState] = useState<"idle" | "done">("idle");
  const [error, setError] = useState("");
  useEffect(() => {
    api.witness(code).then(setW);
  }, [code]);

  async function stamp() {
    setError("");
    try {
      await api.confirm(code);
      celebrate("gold");
      setState("done");
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <div className="container page narrow witness">
      <p className="chip"><Icon name="stamp" /> חותמת עד</p>
      {w === undefined ? (
        <Loading />
      ) : w === null ? (
        <>
          <h1>הקישור לא עובד</h1>
          <p>אולי הוא הועתק חלקית, או שהשם נמחק מהעץ.</p>
        </>
      ) : (
        <Slip className="slip-open">
          <p className="slip-big">הפתק של {w.name}</p>
          {state === "done" || w.confirmedBy ? (
            <p><Icon name="stamp" /> החותמת עליו{w.confirmedBy && state !== "done" ? ` (של ${w.confirmedBy})` : ""}. תודה!</p>
          ) : w.self ? (
            <p>זה הקישור שלך. שולחים אותו לחבר שהיה איתך בקלפי, והחותמת באה ממנו.</p>
          ) : data?.phase !== "open" ? (
            <p>אפשר להחתים רק ביום הבחירות.</p>
          ) : !data?.me ? (
            <>
              <p>כדי להחתים צריך עץ משלך. שתילה לוקחת עשר שניות.</p>
              <Link className="btn" href="/" onClick={() => sessionStorage.setItem("vt_after_join", `/c/${code}`)}>
                <Icon name="sprout" /> לשתול עץ
              </Link>
            </>
          ) : (
            <>
              <p>ראית את המעטפה נכנסת לקלפי? חותמת אחת מוסיפה {POINTS.confirmed} טיפות לפתק. כל אחד יכול להחתים עד חמישה אנשים.</p>
              <button className="btn btn-gold" onClick={stamp}>
                <Icon name="stamp" /> ראיתי, להחתים
              </button>
            </>
          )}
          <ErrorLine text={error} />
        </Slip>
      )}
    </div>
  );
}

// ---------- demo: three weeks of growing, then election day ----------

const STORY = demoStory(27);
const RUN_MS = 32_000;
const GROW = 0.55; // share of the timeline spent on the weeks before
const DAY_START = 6.5;
const DAY_END = 22;

function clock(h: number) {
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function Demo() {
  const phone = useIsPhone();
  const dock = useRef<HTMLDivElement>(null);
  const [dockH, setDockH] = useState(0);
  useEffect(() => {
    const el = dock.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDockH(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [phone]);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setT((v) => {
        const next = Math.min(1, v + dt / RUN_MS);
        if (next >= 1) setPlaying(false);
        return next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);

  const growing = t < GROW;
  const day = growing ? (t / GROW) * STORY_DAYS : STORY_DAYS;
  const hour = growing ? 15.5 : DAY_START + ((t - GROW) / (1 - GROW)) * (DAY_END - DAY_START);
  const daysLeft = Math.max(0, Math.ceil(STORY_DAYS - day));

  // Only people who have joined by now are on the tree; their parents always joined earlier.
  const joinedCount = useMemo(() => STORY.filter((n) => n.day <= day).length, [day]);
  const nodes = useMemo(() => STORY.filter((n) => n.day <= day), [joinedCount]); // eslint-disable-line react-hooks/exhaustive-deps
  const votedAt = (i: number) => !growing && STORY[i].t != null && STORY[i].t! <= hour;

  const stats = useMemo(() => {
    let voted = 0,
      direct = 0,
      directVoted = 0;
    for (const n of nodes.slice(1)) {
      const v = !growing && n.t != null && n.t <= hour;
      if (v) voted++;
      if (n.p === 0) {
        direct++;
        if (v) directVoted++;
      }
    }
    const meVoted = !growing && STORY[0].t! <= hour;
    const watered = Math.min(Math.floor(day), STORY_DAYS);
    const pts = pointsOf({ voted: meVoted, planned: day > 3, confirmed: meVoted && hour > 9, photo: meVoted && hour > 8.6, watered, directJoined: direct, directVoted, totalVoted: voted });
    return { people: nodes.length - 1, voted: voted + (meVoted ? 1 : 0), pts, meVoted };
  }, [nodes, growing, hour, day]);

  // The caption feed: the latest few events, newest first.
  const feed = useMemo(() => {
    if (growing) {
      return STORY.filter((n) => n.i > 0 && n.day <= day)
        .sort((a, b) => b.day - a.day)
        .slice(0, 4)
        .map((n) => ({ key: `j${n.i}`, text: n.name, sub: n.p === 0 ? "הצטרפות דרך הקישור שלך" : `הצטרפות דרך ${STORY[n.p!].name}`, gold: false }));
    }
    return STORY.filter((n) => n.t != null && n.t <= hour)
      .sort((a, b) => b.t! - a.t!)
      .slice(0, 4)
      .map((n) => ({ key: `v${n.i}`, text: n.i === 0 ? "הפתק שלך" : n.name, sub: `פתק זהב · ${clock(n.t!)}`, gold: true }));
  }, [growing, day, hour]);

  const lv = level(stats.pts);
  const chapter = growing ? (day < 2 ? "שותלים עץ" : day < 9 ? "החברים הראשונים מצטרפים" : "חברים של חברים") : hour < 12 ? "יום הבחירות: בוקר" : hour < 18 ? "יום הבחירות: צהריים" : "יום הבחירות: ערב";

  const playButton = (
    <button
      className="btn btn-big"
      onClick={() => {
        if (t >= 1) setT(0);
        setPlaying((p) => !p);
      }}
    >
      <Icon name={playing ? "pause" : t >= 1 ? "replay" : "play"} /> {playing ? "עצירה" : t >= 1 ? "מההתחלה" : t > 0 ? "המשך" : "הפעלה"}
    </button>
  );
  const slider = (
    <label className="slider">
      <span className="sr-only">{growing ? "השבועות שלפני" : "השעות של יום הבחירות"}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.002}
        value={t}
        onChange={(e) => {
          setPlaying(false);
          setT(Number(e.target.value));
        }}
        aria-valuetext={growing ? `עוד ${daysLeft} ימים לבחירות` : clock(hour)}
      />
    </label>
  );

  if (phone)
    return (
      <div className="phone-game">
        <Scene
          className="phone-scene"
          nodes={nodes}
          votedAt={votedAt}
          hour={hour}
          species="olive"
          levelIndex={lv.index}
          ballots={stats.voted}
          stamps={{ voted: stats.meVoted, witnessed: stats.meVoted && hour > 9 }}
          showNames={nodes.length <= 40}
          animate={false}
          insetBottom={dockH}
          label={growing ? `העץ ביום ${Math.floor(day)} מתוך ${STORY_DAYS}: ${stats.people} אנשים` : `יום הבחירות בשעה ${clock(hour)}: ${stats.voted} מתוך ${stats.people + 1} הצביעו`}
        />
        <div className="phone-hud">
          <span className={`hud-chip ${growing ? "" : "hud-today"}`}>
            <Icon name="ballot" size={14} /> {growing ? `עוד ${daysLeft} ימים` : clock(hour)}
          </span>
          <span className="hud-chip">
            <Icon name="tree" size={14} /> {stats.people}
          </span>
          <span className="hud-chip">
            <Icon name="sparkle" size={14} /> {stats.voted}
          </span>
          <span className="hud-chip">
            <Icon name="drop" size={14} /> {stats.pts}
          </span>
        </div>
        <p className="phone-tally">{chapter} · הדגמה, לא נתונים אמיתיים</p>
        <div className="phone-dock" ref={dock}>
          {feed[0] && (
            <p className={`demo-toast ${feed[0].gold ? "gold" : ""}`} aria-live="polite">
              <Icon name={feed[0].gold ? "ballot" : "sprout"} size={14} /> <b>{feed[0].text}</b> <span>{feed[0].sub}</span>
            </p>
          )}
          {slider}
          <div className="row demo-row">
            {playButton}
            <button className="btn-link" onClick={() => { setPlaying(false); setT(GROW + 0.001); }}>
              ליום הבחירות
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="container page demo">
      <p className="chip">
        <Icon name="play" /> הדגמה · עץ מומצא, לא נתונים אמיתיים
      </p>
      <h1>מעציץ ליער, בחצי דקה</h1>
      <div className="demo-grid">
        <figure className="world">
          <Scene
            nodes={nodes}
            votedAt={votedAt}
            hour={hour}
            species="almond"
            levelIndex={lv.index}
            ballots={stats.voted}
            stamps={{ voted: stats.meVoted, witnessed: stats.meVoted && hour > 9 }}
            showNames={nodes.length <= 40}
            animate={false}
            label={growing ? `העץ ביום ${Math.floor(day)} מתוך ${STORY_DAYS}: ${stats.people} אנשים` : `יום הבחירות בשעה ${clock(hour)}: ${stats.voted} מתוך ${stats.people + 1} הצביעו`}
          />
          <figcaption>{chapter}</figcaption>
        </figure>
        <div className="demo-side">
          <Slip>
            {growing ? (
              <p className="slip-count">
                <b>{daysLeft}</b> ימים לבחירות
              </p>
            ) : (
              <>
                <p className="demo-clock">{clock(hour)}</p>
                <p>יום שלישי, {ELECTION_DATE_LABEL}</p>
              </>
            )}
          </Slip>
          <div className="row">
            <button
              className="btn btn-big"
              onClick={() => {
                if (t >= 1) setT(0);
                setPlaying((p) => !p);
              }}
            >
              <Icon name={playing ? "pause" : t >= 1 ? "replay" : "play"} /> {playing ? "עצירה" : t >= 1 ? "מההתחלה" : t > 0 ? "המשך" : "הפעלה"}
            </button>
          </div>
          <div className="row demo-jumps">
            <button className="btn-link" onClick={() => { setPlaying(false); setT(GROW + 0.001); }}>
              לקפוץ ליום הבחירות
            </button>
          </div>
          <label className="slider">
            <span>{growing ? "השבועות שלפני" : "השעות של יום הבחירות"}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.002}
              value={t}
              onChange={(e) => {
                setPlaying(false);
                setT(Number(e.target.value));
              }}
              aria-valuetext={growing ? `עוד ${daysLeft} ימים לבחירות` : clock(hour)}
            />
          </label>
          <ol className="feed" aria-live="polite">
            {feed.map((f) => (
              <li key={f.key} className={f.gold ? "gold" : ""}>
                <Icon name={f.gold ? "ballot" : "sprout"} size={14} />
                <b>{f.text}</b>
                <span>{f.sub}</span>
              </li>
            ))}
          </ol>
          <p className="demo-stats">
            <span>
              <b>{stats.people}</b> בעץ
            </span>
            <span className="gold-n">
              <b>{stats.voted}</b> פתקי זהב
            </span>
            <span>
              <b>{stats.pts}</b> טיפות · {lv.name}
            </span>
          </p>
          <Link className="btn btn-ghost" href="/">
            <Icon name="sprout" /> לשתול עץ אמיתי
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
      <h1>עץ ההצבעה</h1>
      <p>
        יום הבחירות בישראל עדיין עשוי מנייר: מעטפה כחולה, מגש של פתקים, פרגוד מקרטון וקלפי. במשחק הזה הקלפי היא עציץ. ההצטרפות שותלת בה עץ ונותנת לך קישור אישי. מי שמצטרף דרכו הוא ענף בעץ שלך, וגם מי שהוא מזמין. ביום הבחירות, {ELECTION_DATE_LABEL}, כל מי שהצביע לוחץ &quot;הצבעתי&quot;, והפתק שלו מזהיב אצלו ואצל כל מי שמעליו בעץ.
      </p>
      <p>הפתקים במשחק תמיד ריקים. בקלפי האמיתית האותיות שייכות למפלגות, וכאן אין אף אחת.</p>

      <h2><Icon name="drop" /> טיפות, דרגות וליגות</h2>
      <DropsTable />
      <p>
        הטיפות מגדלות את העץ דרך שש דרגות: {LEVELS.map((l) => l.name).join(", ")}. כל דרגה פותחת עץ חדש ומוסיפה לנוף. יש ליגה ארצית, וכל אחד יכול לפתוח ליגה פרטית עם חברים. הטיפות סמליות: אין פרסים, אין הגרלות ואין שום תמורה, וכך זה יישאר.
      </p>

      <h2><Icon name="ballot" /> מה צריך ביום הבחירות</h2>
      <p>
        תעודה מזהה עם תמונה: תעודת זהות, דרכון או רישיון נהיגה. מצביעים רק בקלפי שאליה משויכים, ואפשר לבדוק אותה{" "}
        <a href={POLL_LOOKUP} target="_blank" rel="noopener noreferrer">
          באתר ועדת הבחירות המרכזית
        </a>
        . ברוב הקלפיות ההצבעה היא בין 07:00 ל־22:00.
      </p>

      <h2><Icon name="stamp" /> חותמת עד, ולמה אין אימות אמיתי</h2>
      <p>אין דרך לבדוק בוודאות שמישהו הצביע בלי לפגוע בפרטיות שלו. לכן סימון &quot;הצבעתי&quot; לבד שווה טיפה אחת, ומה שמוסיף טיפות זה הוכחה מחברים: חותמת עד מחבר שהיה איתך (כל אחד מחתים עד חמישה אנשים), ותמונה מבחוץ לקלפי שרק חברי הליגות שלך רואים. אם שניים מהם מסמנים שזו לא תמונה מקלפי, היא יורדת. בתמונה אף פעם לא מצלמים את הפתק או את הפרגוד.</p>

      <h2><Icon name="lock" /> מה נשמר ומה לא</h2>
      <p>נשמרים שם התצוגה שבחרת, מי הזמין את מי, באילו ליגות את או אתה, ומתי סימנת שהצבעת, השקית או הכנת תוכנית. התוכנית עצמה נשארת בטלפון שלך. תמונה מהקלפי, אם העלית, מוקטנת בטלפון לפני ההעלאה (בלי מיקום ובלי פרטי מכשיר), נראית רק לחברי הליגות שלך, ונמחקת אוטומטית כשהקלפיות נסגרות. לא נשמרים טלפון, מייל או מיקום. העץ לא שואל, לא שומר ולא מציג במי בחרת, ואין בו שום מסר בעד או נגד מפלגה.</p>
      <p>בעץ שלך רואים בשם רק את מי שהזמנת בעצמך. מי שהגיע דרכם מופיע כפתק בלי שם. מחיקת השם אפשרית בכל רגע מתחתית העמוד של העץ שלך.</p>

      <h2><Icon name="sparkle" /> על מה זה נשען</h2>
      <p>ניסוי על 61 מיליון משתמשי פייסבוק בבחירות 2010 בארה״ב מצא שהודעה עם חברים שכבר הצביעו הוציאה יותר אנשים לקלפי, ושההשפעה עברה כמעט רק בין חברים קרובים (Bond ואחרים, Nature, 2012). ניסוי אחר מצא שתוכנית קונקרטית, מתי, איפה ואיך, מעלה את הסיכוי להצביע (Nickerson ו־Rogers, Psychological Science, 2010). בבחירות לכנסת ה־25 ב־2022 שיעור ההצבעה היה 70.6% (המכון הישראלי לדמוקרטיה).</p>

      <h2><Icon name="sprout" /> מאיפה זה בא</h2>
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
      <Scene nodes={sample} votedAt={(i) => sampleVoted.has(i)} label="" levelIndex={3} hour={8.5} showNames={false} animate={false} ballots={sampleVoted.size} stamps={{ voted: true }} className="og-scene" />
      <div className="og-copy">
        <p className="chip"><Icon name="ballot" /> בחירות לכנסת · {ELECTION_DATE_LABEL}</p>
        <h1 className="title">
          עץ
          <br />
          ההצבעה
        </h1>
        <p>עץ שצומח מתוך קלפי. ביום הבחירות, כל מי שהצביע הופך לפתק זהב.</p>
      </div>
    </div>
  );
}
