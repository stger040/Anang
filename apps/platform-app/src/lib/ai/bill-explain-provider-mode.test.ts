import { afterEach, describe, expect, it } from "vitest";

import {
  isAzureOpenAiBillExplainConfigured,
  resolveBillExplainLlmProvider,
} from "@/lib/ai/bill-explain-provider-mode";

describe("resolveBillExplainLlmProvider", () => {
  afterEach(() => {
    delete process.env.BILL_EXPLAIN_LLM_PROVIDER;
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_API_KEY;
    delete process.env.AZURE_OPENAI_DEPLOYMENT;
  });

  it("returns openai when unset and Azure is not fully configured", () => {
    expect(resolveBillExplainLlmProvider()).toBe("openai");
  });

  it("returns azure when BILL_EXPLAIN_LLM_PROVIDER=azure", () => {
    process.env.BILL_EXPLAIN_LLM_PROVIDER = "azure";
    expect(resolveBillExplainLlmProvider()).toBe("azure");
  });

  it("returns openai when BILL_EXPLAIN_LLM_PROVIDER=openai even if Azure vars exist", () => {
    process.env.BILL_EXPLAIN_LLM_PROVIDER = "openai";
    process.env.AZURE_OPENAI_ENDPOINT = "https://x.openai.azure.com";
    process.env.AZURE_OPENAI_API_KEY = "k";
    process.env.AZURE_OPENAI_DEPLOYMENT = "d";
    expect(resolveBillExplainLlmProvider()).toBe("openai");
  });

  it("auto-selects azure when all Azure env vars are set", () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://x.openai.azure.com";
    process.env.AZURE_OPENAI_API_KEY = "k";
    process.env.AZURE_OPENAI_DEPLOYMENT = "my-deploy";
    expect(resolveBillExplainLlmProvider()).toBe("azure");
  });

  it("isAzureOpenAiBillExplainConfigured is false when any piece missing", () => {
    process.env.AZURE_OPENAI_ENDPOINT = "https://x.openai.azure.com";
    process.env.AZURE_OPENAI_API_KEY = "k";
    expect(isAzureOpenAiBillExplainConfigured()).toBe(false);
  });
});
