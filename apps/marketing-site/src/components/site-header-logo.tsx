import Link from "next/link";

/** Wordmark for dark backgrounds (navy header). Asset: public/brand/logo-trans-dark-bg.svg — see docs/LOGO.md */
export function SiteHeaderLogo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <img
        src="/brand/logo-trans-dark-bg.svg"
        alt="Anang"
        width={540}
        height={108}
        className="h-[108px] w-auto max-h-[108px] max-w-[min(92vw,540px)] object-contain object-left"
      />
    </Link>
  );
}
