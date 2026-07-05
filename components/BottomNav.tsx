"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Home",
    icon: (
      <path d="M12 3.5 4 10v10a1 1 0 0 0 1 1h5v-6h4v6h5a1 1 0 0 0 1-1V10l-8-6.5Z" />
    ),
  },
  {
    href: "/search",
    label: "Search",
    icon: (
      <path d="M10.5 3a7.5 7.5 0 1 0 4.7 13.4l4.2 4.2 1.4-1.4-4.2-4.2A7.5 7.5 0 0 0 10.5 3Zm0 2a5.5 5.5 0 1 1 0 11 5.5 5.5 0 0 1 0-11Z" />
    ),
  },
  {
    href: "/library",
    label: "Your Library",
    icon: (
      <path d="M4 4h2v16H4V4Zm5 0h2v16H9V4Zm5 .3 6.8 15-1.8.8L14.2 5l1.8-.7Z" />
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[390px] -translate-x-1/2 border-t border-white/5 bg-gradient-to-t from-black via-black/95 to-black/80"
    >
      <ul className="flex">
        {TABS.map(({ href, label, icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 pb-2 pt-2 text-[11px] ${
                  active ? "text-foreground" : "text-muted"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  {icon}
                </svg>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
