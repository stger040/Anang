import { platformLog, readRequestId } from "@/lib/platform-log";
import { tenantPrisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** POST JSON `{ orgSlug, endpoint, keys: { p256dh, auth } }` — persists subscription when push is enabled. */
export async function POST(req: Request) {
  const requestId = readRequestId(req);
  if (process.env.NEXT_PUBLIC_PATIENT_WEB_PUSH_ENABLED?.trim() !== "1") {
    return NextResponse.json({ error: "Web push disabled" }, { status: 404 });
  }

  let body: {
    orgSlug?: string;
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orgSlug = body.orgSlug?.trim();
  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const auth = body.keys?.auth?.trim();
  if (!orgSlug || !endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "orgSlug, endpoint, keys.p256dh, keys.auth required" },
      { status: 400 },
    );
  }

  const db = tenantPrisma(orgSlug);
  const tenant = await db.tenant.findUnique({
    where: { slug: orgSlug },
    select: { id: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: "Unknown org" }, { status: 404 });
  }

  const ua = req.headers.get("user-agent")?.slice(0, 512) ?? null;

  await db.patientPushSubscription.upsert({
    where: {
      tenantId_endpoint: { tenantId: tenant.id, endpoint },
    },
    create: {
      tenantId: tenant.id,
      orgSlug,
      endpoint,
      p256dh,
      auth,
      userAgent: ua,
    },
    update: {
      orgSlug,
      p256dh,
      auth,
      userAgent: ua,
    },
  });

  platformLog("info", "pay.push.subscription_upserted", {
    tenantId: tenant.id,
    orgSlug,
    ...(requestId ? { requestId } : {}),
  });

  return NextResponse.json({ ok: true });
}
