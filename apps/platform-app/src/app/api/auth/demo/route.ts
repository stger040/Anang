import { prisma } from "@/lib/prisma";
import { DEMO_SESSION_COOKIE } from "@/lib/session";
import { AppRole } from "@prisma/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "unknown user" }, { status: 404 });
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
