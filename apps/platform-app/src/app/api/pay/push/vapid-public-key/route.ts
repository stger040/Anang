import { NextResponse } from "next/server";

/**
 * VAPID public key for patient Web Push (URL-safe base64, no padding).
 * Enable with NEXT_PUBLIC_PATIENT_WEB_PUSH_ENABLED=1 on both server and client builds.
 */
export async function GET() {
  if (process.env.NEXT_PUBLIC_PATIENT_WEB_PUSH_ENABLED?.trim() !== "1") {
    return NextResponse.json({ error: "Web push disabled" }, { status: 404 });
  }
  const publicKey =
    process.env.NEXT_PUBLIC_PATIENT_WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
  if (!publicKey) {
    return NextResponse.json(
      { error: "VAPID public key not configured" },
      { status: 503 },
    );
  }
  return NextResponse.json({ publicKey });
}
