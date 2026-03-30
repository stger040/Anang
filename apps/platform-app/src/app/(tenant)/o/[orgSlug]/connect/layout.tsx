import { requireModule } from "@/lib/module-guard";

export default async function ConnectModuleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  await requireModule(orgSlug, "CONNECT");
  return children;
}
