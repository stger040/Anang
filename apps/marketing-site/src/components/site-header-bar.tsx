"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState } from "react";
import { SiteHeaderLogo } from "@/components/site-header-logo";

type SiteHeaderBarProps = {
  bookUrl: string;
  appUrl: string;
};

export function SiteHeaderBar({ bookUrl, appUrl }: SiteHeaderBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  const close = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, close]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  const loginHref = `${appUrl}/login`;

  return (
    <header className="sticky top-0 z-50 border-b border-brand-navy-dark/20 bg-brand-navy text-white shadow-sm">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1.5 sm:gap-4 sm:px-6">
        <SiteHeaderLogo />

        <nav
          className="hidden items-center gap-8 text-sm font-medium text-white/80 md:flex"
          aria-label="Primary"
        >
          <Link href="/platform" className="transition hover:text-white">
            Platform
          </Link>
          <Link href="/modules" className="transition hover:text-white">
            Modules
          </Link>
          <Link href="/about" className="transition hover:text-white">
            About
          </Link>
          <Link href="/pilot" className="transition hover:text-white">
            Pilot
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <a
            href={bookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15 md:inline-block"
          >
            Book a call
          </a>
          <a
            href={loginHref}
            className="hidden rounded-lg bg-brand-coral px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-coral-hover sm:px-4 md:inline-flex"
          >
            Sign in
          </a>

          <button
            type="button"
            className="inline-flex h-11 w-11 flex-col items-center justify-center gap-1.5 rounded-lg text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:hidden"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span
              className={`block h-0.5 w-6 rounded-full bg-current transition duration-200 ease-out ${
                menuOpen ? "translate-y-[7px] rotate-45" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-6 rounded-full bg-current transition duration-200 ease-out ${
                menuOpen ? "scale-x-0 opacity-0" : ""
              }`}
            />
            <span
              className={`block h-0.5 w-6 rounded-full bg-current transition duration-200 ease-out ${
                menuOpen ? "-translate-y-[7px] -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </div>

      <div
        id={menuId}
        role="region"
        aria-label="Mobile navigation"
        className={
          menuOpen
            ? "border-t border-white/10 bg-brand-navy md:hidden"
            : "hidden"
        }
      >
        <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 pb-4 sm:px-6">
          <Link
            href="/platform"
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-white"
            onClick={close}
          >
            Platform
          </Link>
          <Link
            href="/modules"
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-white"
            onClick={close}
          >
            Modules
          </Link>
          <Link
            href="/about"
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-white"
            onClick={close}
          >
            About
          </Link>
          <Link
            href="/pilot"
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-white"
            onClick={close}
          >
            Pilot
          </Link>
          <a
            href={bookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-white"
            onClick={close}
          >
            Book a call
          </a>
          <a
            href={loginHref}
            className="mt-1 rounded-lg bg-brand-coral px-3 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-brand-coral-hover"
            onClick={close}
          >
            Sign in
          </a>
        </nav>
      </div>
    </header>
  );
}
