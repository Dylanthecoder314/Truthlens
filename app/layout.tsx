import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { CommandPalette } from "@/components/command-palette";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-display", subsets: ["latin"], axes: ["opsz"] });

export const metadata: Metadata = {
  title: { default: "TruthLens: AI fact-checker", template: "%s · TruthLens" },
  description:
    "Paste text or a link. TruthLens pulls out each factual claim, researches it on the live web, and shows a verdict with sources.",
};

// Runs before paint so the page never flashes the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="relative flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-zinc-900 focus:shadow"
        >
          Skip to content
        </a>
        <SiteHeader />
        <CommandPalette />
        {children}
        <footer className="border-t border-zinc-200/70 py-8 text-sm text-zinc-600 dark:border-zinc-800/70 dark:text-zinc-400">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
            <p>TruthLens · AI can be wrong. Always read the sources.</p>
            <nav aria-label="Footer" className="flex gap-4">
              <Link href="/spot-the-fakes" className="hover:text-zinc-900 dark:hover:text-zinc-100">Spot fakes</Link>
              <Link href="/quiz" className="hover:text-zinc-900 dark:hover:text-zinc-100">Play</Link>
              <Link href="/history" className="hover:text-zinc-900 dark:hover:text-zinc-100">History</Link>
              <Link href="/how-it-works" className="hover:text-zinc-900 dark:hover:text-zinc-100">How it works</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
