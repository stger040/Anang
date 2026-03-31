import Link from "next/link";
import { getBrand } from "@anang/brand";
import { getBookMeetingUrl } from "@anang/config";

export const metadata = { title: "Pilot & contact" };

export default async function PilotPage() {
  const b = getBrand();
  const bookUrl = getBookMeetingUrl();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold text-slate-900">
        Request a pilot
      </h1>
      <p className="mt-4 max-w-2xl text-slate-600">
        We’re onboarding a small number of design partners. Tell us about your
        health system and which {b.product.suiteName} modules matter most —
        especially <strong>Build</strong> for denial prevention.
      </p>

      <div className="mt-10 max-w-lg space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <p className="text-sm font-medium text-slate-900">
            Schedule a conversation
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Book a 30-minute slot to discuss pilots, security review, and
            module fit.
          </p>
          <a
            href={bookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex rounded-lg bg-brand-coral px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-coral-hover"
          >
            Open Calendly
          </a>
        </div>
        <div className="border-t border-slate-100 pt-6">
          <p className="text-sm font-medium text-slate-700">Or email us</p>
          <p className="mt-2 text-sm text-slate-600">
            <a
              href="mailto:hello@anang.ai"
              className="font-medium text-brand-navy underline"
            >
              hello@anang.ai
            </a>{" "}
            — subject line: &quot;Pilot — [Health system name]&quot;.
          </p>
        </div>
        <Link
          href="/"
          className="inline-block text-sm font-medium text-brand-navy hover:underline"
        >
          ← Back home
        </Link>
      </div>
    </div>
  );
}
