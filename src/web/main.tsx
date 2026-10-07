import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./tokens.css";
import "./base.css";
import "./app.css";
import { Link, usePath } from "./router";
import { About, Demo, Home, Leaders, MyTree, OgCard, Restore } from "./pages";

const TITLES: Record<string, string> = {
  "/tree": "העץ שלי",
  "/leaders": "העצים הגדולים",
  "/demo": "הדגמה",
  "/about": "איך זה עובד",
};

function Page({ path }: { path: string }) {
  const invite = path.match(/^\/j\/([a-z0-9]{4,12})\/?$/i);
  if (invite) return <Home code={invite[1].toLowerCase()} />;
  switch (path) {
    case "/tree":
      return <MyTree />;
    case "/leaders":
      return <Leaders />;
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

function App() {
  const path = usePath();
  useEffect(() => {
    // The invite page's title is set by the server (it carries the inviter's name); keep it.
    if (path.startsWith("/j/")) return;
    document.title = TITLES[path] ? `${TITLES[path]} · עץ ההצבעה` : "עץ ההצבעה";
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [path]);

  if (path === "/og-card") return <OgCard />;

  const nav = [
    ["/tree", "העץ שלי"],
    ["/leaders", "העצים הגדולים"],
    ["/demo", "הדגמה"],
    ["/about", "איך זה עובד"],
  ];

  return (
    <>
      <a className="skip-link" href="#main">
        לתוכן
      </a>
      <header className="site-head">
        <div className="container head-row">
          <Link href="/" className="brand">
            <img src="/icon.svg" alt="" width="30" height="30" />
            עץ ההצבעה
          </Link>
          <nav aria-label="ראשי">
            {nav.map(([href, label]) => (
              <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Page path={path} />
      </main>
      <footer className="site-foot">
        <div className="container">
          <p>
            נבנה בהאקתון בחירות 2026. לא קשור לשום מפלגה. לא שואלים, לא שומרים ולא מציגים במי בחרת.
          </p>
        </div>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
