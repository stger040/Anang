import { DEMO_SESSION_COOKIE } from "@/lib/session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const jar = await cookies();
  jar.delete(DEMO_SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
