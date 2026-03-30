import { requireModule } from "@/lib/module-guard";

export default async function SupportModuleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  await requireModule(orgSlug, "SUPPORT");
  return children;
}
