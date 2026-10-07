import { useEffect, useRef, useState } from "react";
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
