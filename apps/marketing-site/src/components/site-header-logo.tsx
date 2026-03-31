import Link from "next/link";

/** Wordmark for dark backgrounds (navy header). Asset: public/brand/logo-trans-dark-bg.svg — see docs/LOGO.md */
export function SiteHeaderLogo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <img
        src="/brand/logo-trans-dark-bg.svg"
        alt="Anang"
        width={180}
        height={36}
        className="h-9 w-auto max-h-9"
      />
    </Link>
  );
}
