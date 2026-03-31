import Link from "next/link";

/** Smaller wordmark for dark footer */
export function SiteFooterLogo() {
  return (
    <Link href="/" className="inline-block">
      <img
        src="/brand/logo-trans-dark-bg.svg"
        alt="Anang"
        width={160}
        height={32}
        className="h-8 w-auto opacity-95"
      />
    </Link>
  );
}
