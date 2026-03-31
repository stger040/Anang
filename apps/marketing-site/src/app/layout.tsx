import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getBrand } from "@anang/brand";
import { getBookMeetingUrl, urls } from "@anang/config";
import { FooterTagline } from "@/components/footer-tagline";
import { SiteFooterLogo } from "@/components/site-footer-logo";
import { SiteHeaderBar } from "@/components/site-header-bar";
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
        <SiteHeaderBar bookUrl={bookUrl} appUrl={appUrl} />
        {children}
        <footer className="border-t border-brand-navy-dark/30 bg-brand-navy-dark text-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
              <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
                <SiteFooterLogo />
                <FooterTagline text={b.product.shortDescription} />
              </div>
              <div className="flex flex-col gap-4 text-sm text-white/75 sm:items-end">
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 sm:justify-end">
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
                <div className="text-white/55 sm:hidden">
                  <p>{urls.marketing}</p>
                  <p className="mt-1">Product: {urls.platform}</p>
                </div>
              </div>
            </div>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:justify-between">
              <p className="text-center text-xs text-white/45 sm:text-left">
                © {new Date().getFullYear()} {b.company.legalName}. All rights
                reserved.
              </p>
              <div className="hidden text-sm text-white/55 sm:block sm:text-right">
                <p>{urls.marketing}</p>
                <p className="mt-1">Product: {urls.platform}</p>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
