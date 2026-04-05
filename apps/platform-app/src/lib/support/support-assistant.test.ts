import { describe, expect, it } from "vitest";

import { runSupportAssistantTurn } from "@/lib/support/support-assistant";

describe("runSupportAssistantTurn", () => {
  it("suggests escalation for legal-adjacent wording", () => {
    const r = runSupportAssistantTurn({
      messages: [{ role: "user", content: "I will contact my attorney about this bill" }],
      openTaskCount: 0,
      urgentOpenCount: 0,
    });
    expect(r.escalationRecommended).toBe(true);
    expect(r.suggestedTools).toContain("escalate_to_human");
  });

  it("mentions open task count when asked about queue", () => {
    const r = runSupportAssistantTurn({
      messages: [{ role: "user", content: "What's open in the queue?" }],
      openTaskCount: 3,
      urgentOpenCount: 1,
    });
    expect(r.reply).toContain("3");
    expect(r.suggestedTools).toContain("list_open_support_tasks");
  });
});
