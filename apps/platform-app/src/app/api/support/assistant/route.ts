import { prisma } from "@/lib/prisma";
import { platformLog, readRequestId } from "@/lib/platform-log";
import { getSession } from "@/lib/session";
import { assertOrgAccess } from "@/lib/tenant-context";
import { maybeRunSupportAssistantLlmTurn } from "@/lib/support/support-assistant-llm";
import {
  runSupportAssistantTurn,
  supportAssistantToolDefinitionsJson,
  type SupportAssistantMessage,
} from "@/lib/support/support-assistant";
import { ModuleKey } from "@prisma/client";
import { NextResponse } from "next/server";

/** POST JSON `{ orgSlug, message, history? }` — SUPPORT module; template assistant or optional LLM when `SUPPORT_ASSISTANT_LLM_ENABLED`. */
export async function POST(req: Request) {
  const requestId = readRequestId(req);
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    orgSlug?: string;
    message?: string;
    history?: unknown[];
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const orgSlug = body.orgSlug?.trim();
  const message = body.message?.trim() ?? "";
  if (!orgSlug || !message) {
    return NextResponse.json(
      { error: "orgSlug and message required" },
      { status: 400 },
    );
  }

  const ctx = await assertOrgAccess(session, orgSlug);
  if (!ctx || !ctx.effectiveModules.has(ModuleKey.SUPPORT)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const history = Array.isArray(body.history) ? body.history : [];
  const prior: SupportAssistantMessage[] = history
    .filter(
      (m): m is { role: string; content: string } =>
        m != null &&
        typeof m === "object" &&
        "role" in m &&
        "content" in m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string",
    )
    .map((m) =>
      m.role === "user"
        ? { role: "user" as const, content: m.content }
        : { role: "assistant" as const, content: m.content },
    );
  const messages: SupportAssistantMessage[] = [
    ...prior,
    { role: "user" as const, content: message },
  ].slice(-12);

  const [openTaskCount, urgentOpenCount] = await Promise.all([
    prisma.supportTask.count({
      where: { tenantId: ctx.tenant.id, status: { not: "resolved" } },
    }),
    prisma.supportTask.count({
      where: {
        tenantId: ctx.tenant.id,
        status: { not: "resolved" },
        priority: "urgent",
      },
    }),
  ]);

  const llmResult = await maybeRunSupportAssistantLlmTurn(
    {
      messages,
      openTaskCount,
      urgentOpenCount,
    },
    { tenantId: ctx.tenant.id, orgSlug, requestId },
  );

  const result =
    llmResult ??
    runSupportAssistantTurn({
      messages,
      openTaskCount,
      urgentOpenCount,
    });

  platformLog("info", "support.assistant.turn", {
    tenantId: ctx.tenant.id,
    orgSlug,
    mode: llmResult ? "llm" : "template",
    escalationRecommended: result.escalationRecommended,
    suggestedToolCount: result.suggestedTools.length,
    ...(requestId ? { requestId } : {}),
  });

  return NextResponse.json({
    ok: true,
    ...result,
    tools: supportAssistantToolDefinitionsJson(),
  });
}
