import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getBrand } from "@anang/brand";
import "./globals.css";

/** Tenant-scoped pages use Prisma + cookies — avoid SSG without DATABASE_URL at build time. */
export const dynamic = "force-dynamic";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export async function generateMetadata(): Promise<Metadata> {
  const b = getBrand();
  return {
    title: {
      default: `${b.product.suiteName} — ${b.company.platformSubdomain}`,
      template: `%s — ${b.product.suiteName}`,
    },
    description: b.product.shortDescription,
  };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
