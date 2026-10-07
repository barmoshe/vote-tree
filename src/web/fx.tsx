import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Celebration effects: a burst of falling leaves and envelopes, and a modal for level-ups.

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

let fire: ((kind: "gold" | "green") => void) | null = null;

export function celebrate(kind: "gold" | "green" = "gold") {
  fire?.(kind);
  if (kind === "gold") navigator.vibrate?.([30, 40, 60]);
}

export function Confetti() {
  const [bursts, setBursts] = useState<{ id: number; kind: "gold" | "green" }[]>([]);
  useEffect(() => {
    fire = (kind) => {
      if (reduced()) return;
      const id = Date.now() + Math.random();
      setBursts((b) => [...b, { id, kind }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 2800);
    };
    return () => {
      fire = null;
    };
  }, []);
  return createPortal(
    <div className="confetti" aria-hidden="true">
      {bursts.map((b) =>
        Array.from({ length: 34 }, (_, k) => {
          const pick = k % 5;
          const kind = b.kind === "gold" ? (pick === 0 ? "env" : pick === 1 ? "glint" : "gold") : pick === 0 ? "drop" : "leaf";
          const px = 4 * (2 + ((k * 7) % 3)); // whole pixel steps
          return (
            <span
              key={`${b.id}-${k}`}
              className={`conf conf-${kind}`}
              style={{
                insetInlineStart: `${(k * 37) % 100}%`,
                width: kind === "env" ? px * 1.5 : px,
                height: px,
                animationDelay: `${(k % 9) * 70}ms`,
                animationDuration: `${1600 + ((k * 53) % 900)}ms`,
                ["--drift" as string]: `${((k * 29) % 120) - 60}px`,
                ["--spin" as string]: `${(((k * 71) % 4) - 2) * 90}deg`,
              }}
            />
          );
        }),
      )}
    </div>,
    document.body,
  );
}

export function Modal({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: React.ReactNode; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && children}
    </dialog>
  );
}

/** True on phone widths: the layout switches to the full-screen game. */
export function useIsPhone() {
  const q = "(max-width: 719px)";
  const [m, setM] = useState(() => typeof matchMedia !== "undefined" && matchMedia(q).matches);
  useEffect(() => {
    const mm = matchMedia(q);
    const f = () => setM(mm.matches);
    mm.addEventListener("change", f);
    return () => mm.removeEventListener("change", f);
  }, []);
  return m;
}

/**
 * A bottom sheet: everything stays in the thumb zone. A modal <dialog> (focus trap, Escape),
 * closed by the button, a tap on the backdrop, or dragging the grip down.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const start = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    setDy(0);
  }, [open]);
  const down = (e: React.PointerEvent) => {
    start.current = e.clientY;
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (start.current != null) setDy(Math.max(0, e.clientY - start.current));
  };
  const up = () => {
    if (dy > 90) onClose();
    start.current = null;
    setDy(0);
  };
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      style={dy ? { transform: `translateY(${dy}px)`, transition: "none" } : undefined}
    >
      {open && (
        <>
          <div className="sheet-head" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            <span className="sheet-grip" aria-hidden="true" />
            <h2>{title}</h2>
            <button className="btn-link sheet-close" onClick={onClose}>
              סגירה
            </button>
          </div>
          <div className="sheet-body">{children}</div>
        </>
      )}
    </dialog>
  );
}
