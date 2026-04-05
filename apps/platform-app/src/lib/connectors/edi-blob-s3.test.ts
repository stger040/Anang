import { afterEach, describe, expect, it, vi } from "vitest";

import { buildEdiBlobObjectKey } from "./edi-blob-s3";

describe("buildEdiBlobObjectKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses prefix, tenant id, safe kind, 16-char hash prefix, and 12-hex suffix", () => {
    vi.stubEnv("EDI_S3_PREFIX", "my-org/prod");
    const k = buildEdiBlobObjectKey({
      tenantId: "clxyz",
      sha256Hex: "abcdef".repeat(10) + "abcd",
      sourceKind: "x12/clearinghouse",
    });
    expect(k).toMatch(
      /^my-org\/prod\/tenant-clxyz\/x12_clearinghouse\/[a-f0-9]{16}-[a-f0-9]{12}\.txt$/,
    );
  });
});
