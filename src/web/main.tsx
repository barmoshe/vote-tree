import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./tokens.css";
import "./base.css";
import "./app.css";
import { Link, usePath } from "./router";
import { Confetti } from "./fx";
import { Icon } from "./icons";
import { About, Demo, Home, LeagueView, Leagues, MyTree, OgCard, Restore, WitnessPage } from "./pages";

const TITLES: Record<string, string> = {
  "/tree": "העץ שלי",
  "/leagues": "ליגות",
  "/demo": "הדגמה",
  "/about": "איך זה עובד",
};

const CODE = "([a-z0-9]{4,12})";

function Page({ path }: { path: string }) {
  const m = (prefix: string) => path.match(new RegExp(`^/${prefix}/${CODE}/?$`, "i"))?.[1]?.toLowerCase();
  const invite = m("j");
  if (invite) return <Home code={invite} />;
  const league = m("l");
  if (league) return <LeagueView code={league} />;
  const witness = m("c");
  if (witness) return <WitnessPage code={witness} />;
  switch (path) {
    case "/tree":
      return <MyTree />;
    case "/leagues":
    case "/leaders":
      return <Leagues />;
    case "/demo":
      return <Demo />;
    case "/about":
      return <About />;
    case "/restore":
      return <Restore />;
    default:
      return <Home />;
  }
}

const TABS: [string, string, string][] = [
  ["/tree", "tree", "העץ שלי"],
  ["/leagues", "trophy", "ליגות"],
  ["/demo", "play", "הדגמה"],
  ["/about", "help", "איך זה עובד"],
];

function App() {
  const path = usePath();
  useEffect(() => {
    document.body.dataset.route = path; // lets phone styles drop the header on the game screen
  }, [path]);
  useEffect(() => {
    // Shared links get their title from the server (it names who sent them); keep it.
    if (/^\/[jlc]\//.test(path)) return;
    document.title = TITLES[path] ? `${TITLES[path]} · עץ ההצבעה` : "עץ ההצבעה";
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [path]);

  if (path === "/og-card") return <OgCard />;

  return (
    <>
      <a className="skip-link" href="#main">
        לתוכן
      </a>
      <header className="site-head">
        <div className="container head-row">
          <Link href="/" className="brand">
            <img src="/icon.svg" alt="" width="32" height="32" className="brand-mark" />
            עץ ההצבעה
          </Link>
          <nav className="tabs" aria-label="ראשי">
            {TABS.map(([href, icon, label]) => (
              <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
                <Icon name={icon} size={20} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Page path={path} />
      </main>
      {(path === "/" || path === "/about" || path.startsWith("/j/")) && <footer className="site-foot">
        <div className="container">
          <p>נבנה בהאקתון בחירות 2026. לא קשור לשום מפלגה. לא שואלים, לא שומרים ולא מציגים במי בחרת.</p>
        </div>
      </footer>}
      <Confetti />
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
