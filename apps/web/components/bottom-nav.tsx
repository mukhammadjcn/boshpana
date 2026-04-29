"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { getAuthToken } from "@/lib/auth";

type Tab = {
  href: Route;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

const TABS: Tab[] = [
  {
    href: "/dashboard" as Route,
    label: "Bosh sahifa",
    icon: (active) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 11l9-8 9 8" />
        <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
      </svg>
    )
  },
  {
    href: "/dashboard/games" as Route,
    label: "O'yinlarim",
    icon: (active) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3" y="6" width="18" height="14" rx="3" />
        <path d="M7 10h2M11 10h2M15 10h2M7 14h10" />
      </svg>
    )
  },
  {
    href: "/dashboard/profile" as Route,
    label: "Profil",
    icon: (active) => (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={active ? 2.4 : 1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
      </svg>
    )
  }
];

export function BottomNav() {
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(!!getAuthToken());
  }, []);

  if (!authed) return null;

  return (
    <>
      {/* Spacer keeps content from being hidden under the fixed bar. */}
      <div aria-hidden className="h-20" />
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line-subtle bg-bg-base/95 pb-safe backdrop-blur">
        <ul className="mx-auto grid max-w-xl grid-cols-3">
          {TABS.map((tab, index) => {
            const active =
              index === 0
                ? pathname === tab.href
                : pathname.startsWith(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition ${
                    active
                      ? "text-brand"
                      : "text-ink-muted"
                  }`}
                >
                  {tab.icon(active)}
                  <span>{tab.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
