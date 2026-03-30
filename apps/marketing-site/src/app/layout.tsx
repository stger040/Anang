import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getBrand } from "@anang/brand";
import { urls } from "@anang/config";
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

  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans">
        <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-sm font-bold text-white">
                A
              </span>
              <span className="font-semibold text-slate-900">
                {b.company.displayName}
              </span>
            </Link>
            <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
              <Link href="/platform" className="hover:text-slate-900">
                Platform
              </Link>
              <Link href="/modules" className="hover:text-slate-900">
                Modules
              </Link>
              <Link href="/about" className="hover:text-slate-900">
                About
              </Link>
              <Link href="/pilot" className="hover:text-slate-900">
                Pilot
              </Link>
            </nav>
            <div className="flex items-center gap-3">
              <Link
                href="/pilot"
                className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:inline"
              >
                Request a pilot
              </Link>
              <a
                href={`${appUrl}/login`}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800"
              >
                Sign in
              </a>
            </div>
          </div>
        </header>
        {children}
        <footer className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
              <div>
                <p className="font-semibold text-slate-900">
                  {b.company.displayName}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {b.product.shortDescription}
                </p>
              </div>
              <div className="text-sm text-slate-500">
                <p>{urls.marketing}</p>
                <p className="mt-1">Product: {urls.platform}</p>
              </div>
            </div>
            <p className="mt-8 text-xs text-slate-400">
              © {new Date().getFullYear()} {b.company.legalName}. All rights
              reserved.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
