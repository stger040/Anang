import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchBuildAiCodeSuggestions } from "@/lib/build/build-ai-openai";

import {
  IMMUTABLE_BUILD_DRAFT_ERROR,
  suggestDraftFromEncounter,
} from "./suggest-draft-from-encounter";

vi.mock("@/lib/build/build-ai-openai", () => ({
  fetchBuildAiCodeSuggestions: vi.fn(),
}));

vi.mock("@/lib/build/sync-draft-rules", () => ({
  syncClaimDraftRuleIssues: vi.fn(),
}));

const encounter = {
  id: "enc-1",
  dateOfService: new Date("2026-03-18T15:30:00.000Z"),
  chiefComplaint: "Follow-up",
  visitSummary: "Synthetic encounter",
  placeOfService: "11",
  visitType: "office",
  assessment: null,
  providerSpecialty: null,
  patient: {
    firstName: "Sam",
    lastName: "Test",
    mrn: "MRN-1",
    dob: new Date("1980-01-01T00:00:00.000Z"),
  },
};

function run(db: PrismaClient) {
  return suggestDraftFromEncounter({
    db,
    tenantId: "tenant-1",
    orgSlug: "synthetic-test",
    encounterId: encounter.id,
    actorUserId: "user-1",
  });
}

describe("suggestDraftFromEncounter immutable draft protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    {
      label: "approved",
      draft: { id: "draft-1", status: "ready", submittedClaim: null },
    },
    {
      label: "claim-linked",
      draft: {
        id: "draft-1",
        status: "draft",
        submittedClaim: { id: "claim-1" },
      },
    },
  ])("does not call the model for a $label draft", async ({ draft }) => {
    const transaction = vi.fn();
    const db = {
      encounter: { findFirst: vi.fn().mockResolvedValue(encounter) },
      claimDraft: { findFirst: vi.fn().mockResolvedValue(draft) },
      $transaction: transaction,
    } as unknown as PrismaClient;

    await expect(run(db)).resolves.toEqual({
      ok: false,
      error: IMMUTABLE_BUILD_DRAFT_ERROR,
    });
    expect(fetchBuildAiCodeSuggestions).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rechecks mutability after the model call before deleting lines", async () => {
    vi.mocked(fetchBuildAiCodeSuggestions).mockResolvedValue({
      ok: true,
      lines: [],
      rawJson: "{}",
    });

    const deleteLines = vi.fn();
    const deleteIssues = vi.fn();
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: "draft-1" }]),
      claimDraft: {
        findFirst: vi.fn().mockResolvedValue({
          id: "draft-1",
          status: "ready",
          submittedClaim: null,
        }),
      },
      claimDraftLine: { deleteMany: deleteLines },
      claimIssue: { deleteMany: deleteIssues },
    };
    const db = {
      encounter: { findFirst: vi.fn().mockResolvedValue(encounter) },
      claimDraft: {
        findFirst: vi.fn().mockResolvedValue({
          id: "draft-1",
          status: "draft",
          submittedClaim: null,
        }),
      },
      $transaction: vi.fn(
        async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    } as unknown as PrismaClient;

    await expect(run(db)).resolves.toEqual({
      ok: false,
      error: IMMUTABLE_BUILD_DRAFT_ERROR,
    });
    expect(fetchBuildAiCodeSuggestions).toHaveBeenCalledOnce();
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(deleteLines).not.toHaveBeenCalled();
    expect(deleteIssues).not.toHaveBeenCalled();
  });
});
