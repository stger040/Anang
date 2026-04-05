import { requireModuleForSession } from "@/lib/module-guard";

export default async function InsightModuleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  await requireModuleForSession(orgSlug, "INSIGHT");
  return children;
}
