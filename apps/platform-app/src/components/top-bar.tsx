import Link from "next/link";

export function TopBar({
  orgLabel,
  userEmail,
  actions,
}: {
  orgLabel: string;
  userEmail: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur sm:px-6 sm:py-3">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <Link
          href="/login"
          className="flex shrink-0 items-center"
          aria-label="Go to login"
        >
          <img
            src="/brand/logo-trans-light-bg.svg"
            alt=""
            width={360}
            height={84}
            className="h-[84px] w-auto max-h-[84px] max-w-[min(42vw,360px)] object-contain object-left"
          />
        </Link>
        <span className="hidden text-slate-300 sm:inline" aria-hidden>
          |
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {orgLabel}
          </p>
          <p className="truncate text-xs text-slate-500">{userEmail}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </header>
  );
}
