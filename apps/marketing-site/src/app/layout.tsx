import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getBrand } from "@anang/brand";
import { getBookMeetingUrl, urls } from "@anang/config";
import { SiteFooterLogo } from "@/components/site-footer-logo";
import { SiteHeaderLogo } from "@/components/site-header-logo";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-geist-sans" });

export async function generateMetadata(): Promise<Metadata> {
  const b = getBrand();
  return {
    title: {
      default: `${b.company.displayName} — ${b.product.tagline}`,
      template: `%s — ${b.company.displayName}`,
    },
    description: b.product.shortDescription,
    metadataBase: new URL(`https://${b.company.domain}`),
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const b = getBrand();
  const appUrl = `https://${b.company.platformSubdomain}`;
  const bookUrl = getBookMeetingUrl();

  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans">
        <header className="sticky top-0 z-50 border-b border-brand-navy-dark/20 bg-brand-navy text-white shadow-sm">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <SiteHeaderLogo />
            <nav className="hidden items-center gap-8 text-sm font-medium text-white/80 md:flex">
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
                className="hidden rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/15 sm:inline-block"
              >
                Book a call
              </a>
              <a
                href={`${appUrl}/login`}
                className="rounded-lg bg-brand-coral px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-coral-hover sm:px-4"
              >
                Sign in
              </a>
            </div>
          </div>
        </header>
        {children}
        <footer className="border-t border-brand-navy-dark/30 bg-brand-navy-dark text-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
              <div>
                <SiteFooterLogo />
                <p className="mt-4 max-w-md text-sm text-white/70">
                  {b.product.shortDescription}
                </p>
              </div>
              <div className="flex flex-col gap-4 text-sm text-white/75 sm:items-end">
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <Link href="/platform" className="hover:text-white">
                    Platform
                  </Link>
                  <Link href="/modules" className="hover:text-white">
                    Modules
                  </Link>
                  <Link href="/about" className="hover:text-white">
                    About
                  </Link>
                  <Link href="/pilot" className="hover:text-white">
                    Pilot
                  </Link>
                  <a
                    href={bookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white"
                  >
                    Book a call
                  </a>
                  <a
                    href={`${appUrl}/login`}
                    className="hover:text-white"
                  >
                    Product sign in
                  </a>
                </div>
                <div className="text-white/55">
                  <p>{urls.marketing}</p>
                  <p className="mt-1">Product: {urls.platform}</p>
                </div>
              </div>
            </div>
            <p className="mt-8 text-xs text-white/45">
              © {new Date().getFullYear()} {b.company.legalName}. All rights
              reserved.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
