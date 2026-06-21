const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
}

export async function sendPatientPushToTokens(
  tokens: string[],
  message: Omit<ExpoMessage, "to">,
): Promise<void> {
  if (tokens.length === 0) return;
  const messages: ExpoMessage[] = tokens.map((to) => ({ to, sound: "default", ...message }));
  // Expo allows up to 100 per batch
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(batch),
    }).catch(() => {/* best-effort — don't fail statement creation */});
  }
}

export async function sendNewStatementPush(
  db: ReturnType<typeof import("@/lib/prisma").tenantPrisma>,
  tenantId: string,
  patientId: string,
  amountCents: number,
): Promise<void> {
  const rows = await db.patientExpoPushToken.findMany({
    where: { tenantId, patientId },
    select: { token: true },
  });
  if (rows.length === 0) return;
  const dollars = `$${(amountCents / 100).toFixed(2)}`;
  await sendPatientPushToTokens(
    rows.map((r) => r.token),
    {
      title: "New billing statement",
      body: `You have a new statement for ${dollars}. Tap to view and pay.`,
      data: { screen: "home" },
    },
  );
}
