import Link from "next/link";
import { LogoMark } from "./logo";
import { NavLinks } from "./nav-links";
import { PaletteButton } from "./command-palette";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/70 backdrop-blur-lg dark:border-zinc-800/70 dark:bg-zinc-950/70">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="group flex items-center gap-2 rounded-lg">
          <LogoMark className="scan size-7" />
          <span className="hidden font-display text-[1.35rem] font-semibold leading-none tracking-tight min-[420px]:inline">
            Truth<span className="italic font-medium">Lens</span>
          </span>
          <span className="sr-only min-[420px]:hidden">TruthLens home</span>
        </Link>
        <div className="flex min-w-0 items-center gap-1">
          <div className="no-scrollbar min-w-0 overflow-x-auto"><NavLinks /></div>
          <PaletteButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
