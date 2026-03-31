import { getBrand } from "@anang/brand";
import { getBookMeetingUrl, urls } from "@anang/config";
import { DemoSignInForm } from "@/components/demo-sign-in-form";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const b = getBrand();
  const bookUrl = getBookMeetingUrl();

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-cream via-white to-brand-sky/30">
      <div className="mx-auto flex w-full max-w-3xl flex-col justify-center px-4 py-12 sm:py-20">
        <div className="mb-10 text-center">
          <Link
            href={urls.marketing}
            className="inline-flex flex-col items-center gap-2 text-sm font-semibold text-brand-navy sm:flex-row"
          >
            <img
              src="/brand/logo-trans-light-bg.svg"
              alt={b.company.displayName}
              width={200}
              height={40}
              className="h-10 w-auto"
            />
          </Link>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Sign in
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-slate-600">
            Product demo environment — use the shared demo credentials and select
            a <strong>module tier</strong> to mirror how future clients might
            buy Anang. Replace with SSO before production.
          </p>
        </div>

        {sp.error === "forbidden" ? (
          <p className="mb-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            You do not have access to that area.
          </p>
        ) : null}
        {sp.error === "no_org" ? (
          <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This account has no organization membership.
          </p>
        ) : null}

        <DemoSignInForm marketingUrl={urls.marketing} bookMeetingUrl={bookUrl} />
      </div>
    </div>
  );
}
