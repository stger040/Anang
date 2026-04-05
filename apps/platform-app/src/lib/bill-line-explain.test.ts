import { resetDefaultBillLineExplainerForTests } from "@/lib/ai/resolve-bill-line-explainer";
import { afterEach, describe, expect, it } from "vitest";
import {
  explainStatementLine,
  templateExplainStatementLine,
} from "./bill-line-explain";

describe("templateExplainStatementLine", () => {
  it("includes code, description, and currency", () => {
    const t = templateExplainStatementLine({
      code: "99213",
      description: "Office visit",
      amountCents: 15000,
    });
    expect(t).toContain("99213");
    expect(t).toContain("Office visit");
    expect(t).toContain("$150.00");
    expect(t.toLowerCase()).toContain("eob");
  });

  it("explains fallback descriptions without special casing", () => {
    const t = templateExplainStatementLine({
      code: "VISIT",
      description: "Balance from FHIR import when no Claim lines were importable",
      amountCents: 25000,
    });
    expect(t).toContain("VISIT");
    expect(t.toLowerCase()).toContain("eob");
  });
});

describe("explainStatementLine", () => {
  afterEach(() => {
    resetDefaultBillLineExplainerForTests();
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_DISABLE_BILL_EXPLAIN;
    delete process.env.BILL_EXPLAIN_LLM_PROVIDER;
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
  });

  it("uses template when OpenAI is not configured", async () => {
    const r = await explainStatementLine({
      code: "X",
      description: "Test line",
      amountCents: 100,
    });
    expect(r.source).toBe("template");
    expect(r.text.length).toBeGreaterThan(20);
  });

  it("uses template when OPENAI_DISABLE_BILL_EXPLAIN is set even if key exists", async () => {
    process.env.OPENAI_API_KEY = "sk-test-fake";
    process.env.OPENAI_DISABLE_BILL_EXPLAIN = "1";
    const r = await explainStatementLine({
      code: "99213",
      description: "Office visit",
      amountCents: 20000,
    });
    expect(r.source).toBe("template");
  });

  // Azure / live OpenAI paths call real HTTPS; verify with OPENAI_* / AZURE_* set in a dev or staging env.
});
