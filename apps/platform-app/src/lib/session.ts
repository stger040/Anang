import { cookies } from "next/headers";
import type { AppRole } from "@prisma/client";

/** Demo cookie session — replace with production auth (WorkOS/Auth0/Clerk/custom JWT). */
export const DEMO_SESSION_COOKIE = "anang_demo_session";

export type DemoSessionPayload = {
  userId: string;
  email: string;
  appRole: AppRole;
};

export async function getDemoSession(): Promise<DemoSessionPayload | null> {
  const jar = await cookies();
  const raw = jar.get(DEMO_SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as DemoSessionPayload;
  } catch {
    return null;
  }
}
