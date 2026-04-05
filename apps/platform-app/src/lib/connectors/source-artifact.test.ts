import { describe, expect, it, vi, afterEach } from "vitest";

import {
  DEFAULT_MAX_INLINE_PAYLOAD_BYTES,
  fingerprintInlinePayload,
  resolveMaxInlinePayloadBytes,
} from "@/lib/connectors/source-artifact";

describe("fingerprintInlinePayload", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stores text when under default cap", () => {
    vi.stubEnv("FHIR_IMPORT_MAX_INLINE_PAYLOAD_BYTES", "");
    const body = '{"a":1}';
    const fp = fingerprintInlinePayload(body);
    expect(fp.byteLength).toBeGreaterThan(0);
    expect(fp.sha256Hex).toMatch(/^[a-f0-9]{64}$/);
    expect(fp.textPayload).toBe(body);
  });

  it("omits text when over cap", () => {
    vi.stubEnv(
      "FHIR_IMPORT_MAX_INLINE_PAYLOAD_BYTES",
      String(Math.max(0, DEFAULT_MAX_INLINE_PAYLOAD_BYTES - 5)),
    );
    const body = "x".repeat(DEFAULT_MAX_INLINE_PAYLOAD_BYTES);
    const fp = fingerprintInlinePayload(body);
    expect(fp.byteLength).toBe(DEFAULT_MAX_INLINE_PAYLOAD_BYTES);
    expect(fp.textPayload).toBeNull();
  });
});

describe("resolveMaxInlinePayloadBytes", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to default on invalid env", () => {
    vi.stubEnv("FHIR_IMPORT_MAX_INLINE_PAYLOAD_BYTES", "not-a-number");
    expect(resolveMaxInlinePayloadBytes()).toBe(DEFAULT_MAX_INLINE_PAYLOAD_BYTES);
  });
});
