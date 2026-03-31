import Link from "next/link";
import { getBookMeetingUrl } from "@anang/config";

/** Reusable “next step” block for inner marketing pages */
export async function PageCta({
  title = "Next step",
}: {
  title?: string;
}) {
  const bookUrl = getBookMeetingUrl();

  return (
    <section className="mt-16 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Book time on our calendar or explore the modular platform overview.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href={bookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex rounded-lg bg-brand-coral px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-coral-hover"
        >
          Book a call
        </a>
        <Link
          href="/modules"
          className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-brand-navy transition hover:bg-slate-50"
        >
          View modules
        </Link>
      </div>
    </section>
  );
}
