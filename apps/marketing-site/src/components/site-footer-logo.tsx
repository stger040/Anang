import Link from "next/link";

/** Wordmark for dark footer — 3× previous 32px height; centered on mobile only */
export function SiteFooterLogo() {
  return (
    <Link
      href="/"
      className="mx-auto inline-block sm:mx-0"
    >
      <img
        src="/brand/logo-trans-dark-bg.svg"
        alt="Anang"
        width={480}
        height={96}
        className="h-24 w-auto max-h-24 max-w-[min(92vw,480px)] object-contain object-center opacity-95 sm:object-left"
      />
    </Link>
  );
}
