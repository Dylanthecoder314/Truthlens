"use client";

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { MAX_INPUT_CHARS } from "@/lib/schemas";

type Mode = "text" | "url";

const EXAMPLES = [
  {
    label: "Famous \"facts\"",
    text: "The Great Wall of China is the only man-made structure visible from space with the naked eye. It stretches more than 21,000 kilometres and was built entirely during the Ming dynasty.",
  },
  {
    label: "Social media post",
    text: "Mind blown 🤯 Humans only use 10% of their brains. Also, Mount Everest grows about 4 millimetres taller every year, and the Eiffel Tower was originally meant to be taken down after 20 years. Honestly the most interesting planet to live on.",
  },
  {
    label: "Science & nature",
    text: "Water boils at 100°C at sea level. The Amazon rainforest produces 20% of the oxygen in the world's atmosphere, and lightning never strikes the same place twice. I think everyone should spend more time in nature.",
  },
];

export function CheckForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (body: { text: string } | { url: string }) => void;
}) {
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);
  const tabTextRef = useRef<HTMLButtonElement>(null);
  const tabUrlRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  const errorId = `${id}-error`;
  const countId = `${id}-count`;

  const over = text.length > MAX_INPUT_CHARS;

  function switchMode(next: Mode, focusTab = false) {
    setMode(next);
    setError(null);
    if (focusTab) (next === "text" ? tabTextRef : tabUrlRef).current?.focus();
  }

  function onTabKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const next: Mode =
        e.key === "Home" ? "text" : e.key === "End" ? "url" : mode === "text" ? "url" : "text";
      switchMode(next, true);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (mode === "text") {
      const value = text.trim();
      if (!value) {
        setError("Please paste some text to check.");
        textRef.current?.focus();
        return;
      }
      if (value.length > MAX_INPUT_CHARS) {
        setError(
          `That's ${value.length.toLocaleString("en-US")} characters. The limit is ${MAX_INPUT_CHARS.toLocaleString("en-US")}. Try checking a shorter excerpt.`,
        );
        textRef.current?.focus();
        return;
      }
      setError(null);
      onSubmit({ text: value });
    } else {
      let value = url.trim();
      if (!value) {
        setError("Please enter a link to an article.");
        urlRef.current?.focus();
        return;
      }
      if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
      try {
        const parsed = new URL(value);
        if (!parsed.hostname.includes(".")) throw new Error("no tld");
      } catch {
        setError("That doesn't look like a valid web address. Example: https://example.com/article");
        urlRef.current?.focus();
        return;
      }
      setError(null);
      onSubmit({ url: value });
    }
  }

  const tabClass = (active: boolean) =>
    `rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-700 dark:text-zinc-50 dark:ring-white/10"
        : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
    }`;

  const fieldBase =
    "block w-full bg-transparent text-base text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus-visible:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-500";

  return (
    <form onSubmit={submit} noValidate className="space-y-3">
      <div className="relative">
        {busy && <span aria-hidden="true" className="glow-border" />}
      <div
        className={`relative overflow-hidden rounded-2xl border bg-white shadow-lg shadow-zinc-900/5 transition focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/15 dark:bg-zinc-900 dark:shadow-black/30 ${
          error || over ? "border-red-400 dark:border-red-500/60" : "border-zinc-200 dark:border-zinc-800"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2.5 dark:border-zinc-800">
          <div role="tablist" aria-label="Input type" className="inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800">
            <button
              ref={tabTextRef}
              type="button"
              role="tab"
              id={`${id}-tab-text`}
              aria-selected={mode === "text"}
              aria-controls={`${id}-panel-text`}
              tabIndex={mode === "text" ? 0 : -1}
              onClick={() => switchMode("text")}
              onKeyDown={onTabKey}
              className={tabClass(mode === "text")}
            >
              Paste text
            </button>
            <button
              ref={tabUrlRef}
              type="button"
              role="tab"
              id={`${id}-tab-url`}
              aria-selected={mode === "url"}
              aria-controls={`${id}-panel-url`}
              tabIndex={mode === "url" ? 0 : -1}
              onClick={() => switchMode("url")}
              onKeyDown={onTabKey}
              className={tabClass(mode === "url")}
            >
              Check a URL
            </button>
          </div>
          {mode === "text" && (
            <p
              id={countId}
              className={`text-xs tabular-nums ${over ? "font-semibold text-red-700 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}
            >
              {text.length.toLocaleString("en-US")} / {MAX_INPUT_CHARS.toLocaleString("en-US")}
              <span className="sr-only"> characters</span>
            </p>
          )}
        </div>

        <div
          role="tabpanel"
          id={`${id}-panel-text`}
          aria-labelledby={`${id}-tab-text`}
          hidden={mode !== "text"}
        >
          <label htmlFor={`${id}-text`} className="sr-only">
            Text to fact-check
          </label>
          <textarea
            ref={textRef}
            id={`${id}-text`}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(null);
            }}
            rows={8}
            placeholder="Paste a paragraph, social media post, or article excerpt…"
            aria-invalid={Boolean(error) || over}
            aria-describedby={`${countId}${error ? ` ${errorId}` : ""}`}
            className={`${fieldBase} min-h-44 resize-y px-4 py-4 leading-relaxed`}
          />
        </div>

        <div
          role="tabpanel"
          id={`${id}-panel-url`}
          aria-labelledby={`${id}-tab-url`}
          hidden={mode !== "url"}
          className="px-4 py-5"
        >
          <label htmlFor={`${id}-url`} className="mb-2 block text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Article URL
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 dark:border-zinc-700 dark:bg-zinc-950/40">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 shrink-0 text-zinc-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
            </svg>
            <input
              ref={urlRef}
              id={`${id}-url`}
              type="url"
              inputMode="url"
              autoComplete="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="https://example.com/news/article"
              aria-invalid={Boolean(error)}
              aria-describedby={`${id}-url-hint${error ? ` ${errorId}` : ""}`}
              className={`${fieldBase} py-3`}
            />
          </div>
          <p id={`${id}-url-hint`} className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            We fetch the page and read the main article text. Paywalled or login-only pages may not work.
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t border-zinc-100 bg-zinc-50/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-950/30">
          {mode === "text" ? (
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <span className="mr-1 text-zinc-500 dark:text-zinc-400">Try:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  onClick={() => {
                    setText(ex.text);
                    setError(null);
                    textRef.current?.focus();
                  }}
                  className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-zinc-700 transition hover:-translate-y-0.5 hover:border-indigo-300 hover:text-indigo-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-400/60 dark:hover:text-indigo-300"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          ) : (
            <span className="hidden sm:block" />
          )}
          <button
            type="submit"
            disabled={busy}
            className="btn-shine inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/30 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-600/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4-4" />
              </svg>
            )}
            {busy ? "Checking…" : "Check facts"}
          </button>
        </div>
      </div>
      </div>

      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-100"
        >
          <span aria-hidden="true" className="font-bold">!</span>
          {error}
        </p>
      )}
    </form>
  );
}
