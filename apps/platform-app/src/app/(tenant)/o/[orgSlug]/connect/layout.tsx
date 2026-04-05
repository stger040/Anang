import { requireModuleForSession } from "@/lib/module-guard";

export default async function ConnectModuleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  await requireModuleForSession(orgSlug, "CONNECT");
  return children;
}
