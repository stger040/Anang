import { prisma } from "@/lib/prisma";
import { getDemoLoginEmail, getDemoPassword } from "@/lib/demo-password";
import {
  TIER_TO_USER_EMAIL,
  type DemoTierId,
} from "@/lib/demo-tiers";
import { DEMO_SESSION_COOKIE } from "@/lib/session";
import { AppRole } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function isValidTier(x: unknown): x is DemoTierId {
  return typeof x === "string" && x in TIER_TO_USER_EMAIL;
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    email?: string;
    password?: string;
    demoTier?: unknown;
  };

  const emailRaw = body.email?.trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  if (!emailRaw) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const demoEmail = getDemoLoginEmail();
  const demoPw = getDemoPassword();

  let targetEmail: string;

  if (emailRaw === demoEmail) {
    if (password !== demoPw) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }
    if (!isValidTier(body.demoTier)) {
      return NextResponse.json(
        { error: "Choose a demo tier for this sign-in email" },
        { status: 400 },
      );
    }
    targetEmail = TIER_TO_USER_EMAIL[body.demoTier];
  } else {
    if (password !== demoPw) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }
    targetEmail = emailRaw;
  }

  const user = await prisma.user.findUnique({ where: { email: targetEmail } });
  if (!user) {
    return NextResponse.json(
      { error: "Unknown user — run db:seed or check tier mapping" },
      { status: 404 },
    );
  }

  const payload = {
    userId: user.id,
    email: user.email,
    appRole: user.appRole,
  };

  const jar = await cookies();
  jar.set(DEMO_SESSION_COOKIE, encodeURIComponent(JSON.stringify(payload)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  });

  let redirectTo: string;
  if (user.appRole === AppRole.SUPER_ADMIN) {
    redirectTo = "/admin";
  } else {
    const m = await prisma.membership.findFirst({
      where: { userId: user.id },
      include: { tenant: { select: { slug: true } } },
      orderBy: { id: "asc" },
    });
    redirectTo = m ? `/o/${m.tenant.slug}/dashboard` : "/login?error=no_org";
  }

  return NextResponse.json({ ok: true, redirectTo });
}
