import Link from "next/link";

export function TopBar({
  suiteName,
  orgLabel,
  userEmail,
  actions,
}: {
  suiteName: string;
  orgLabel: string;
  userEmail: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/login"
          className="shrink-0 text-xs font-semibold uppercase tracking-wide text-teal-800"
        >
          {suiteName}
        </Link>
        <span className="hidden text-slate-300 sm:inline">|</span>
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
