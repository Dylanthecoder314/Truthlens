"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Check" },
  { href: "/spot-the-fakes", label: "Spot fakes" },
  { href: "/quiz", label: "Play" },
  { href: "/history", label: "History" },
  { href: "/how-it-works", label: "How it works" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main">
      <ul className="flex items-center gap-1 text-sm">
        {LINKS.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <li key={link.href} className={link.href === "/" ? "hidden sm:block" : undefined}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 sm:px-3 ${
                  active
                    ? "bg-zinc-900/5 font-medium text-zinc-900 dark:bg-white/10 dark:text-zinc-50"
                    : "text-zinc-700 hover:bg-zinc-900/5 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-zinc-50"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
