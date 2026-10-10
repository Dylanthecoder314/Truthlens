"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const OPEN_EVENT = "truthlens:palette";

export function PaletteButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      aria-label="Open command menu"
      className="hidden items-center gap-1.5 rounded-lg border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-900/5 md:flex dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-white/10"
    >
      Jump to <kbd className="font-mono">⌘K</kbd>
    </button>
  );
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(
    () => [
      { label: "Check a claim", hint: "Paste text or a link", run: () => router.push("/#check") },
      { label: "Spot fake and misleading content", hint: "Field guide", run: () => router.push("/spot-the-fakes") },
      { label: "Play Fact or Fiction", hint: "Quick quiz", run: () => router.push("/quiz") },
      { label: "History", hint: "Recent checks", run: () => router.push("/history") },
      { label: "How it works", hint: "Method and verdicts", run: () => router.push("/how-it-works") },
      {
        label: "Toggle dark mode",
        hint: "Theme",
        run: () => {
          const dark = !document.documentElement.classList.contains("dark");
          document.documentElement.classList.toggle("dark", dark);
          try {
            localStorage.setItem("theme", dark ? "dark" : "light");
          } catch {
            // storage unavailable; the choice still applies for this page view
          }
        },
      },
    ],
    [router],
  );
  const shown = items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));

  const openPalette = () => {
    setQ("");
    setIdx(0);
    setOpen(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPalette();
      } else if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => openPalette();
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  function choose(i: number) {
    const item = shown[i];
    if (!item) return;
    setOpen(false);
    item.run();
  }

  return (
    <div className="fixed inset-0 z-[70] grid place-items-start justify-items-center px-4 pt-[15vh]">
      <div className="pal-backdrop absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div role="dialog" aria-modal="true" aria-label="Command menu" className="pal relative w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIdx((i) => Math.min(i + 1, shown.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") choose(idx);
          }}
          aria-label="Search pages and actions"
          placeholder="Where to?"
          className="w-full border-b border-zinc-200 bg-transparent px-5 py-4 text-lg outline-none placeholder:text-zinc-500 dark:border-zinc-700"
        />
        <ul role="listbox" className="max-h-72 overflow-auto p-2">
          {shown.length === 0 && <li className="px-3 py-4 text-sm text-zinc-600 dark:text-zinc-400">Nothing matches.</li>}
          {shown.map((it, i) => (
            <li key={it.label} role="option" aria-selected={i === idx}>
              <button
                type="button"
                onMouseEnter={() => setIdx(i)}
                onClick={() => choose(i)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left ${i === idx ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900" : ""}`}
              >
                <span className="font-medium">{it.label}</span>
                <span className="text-xs opacity-70">{it.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
