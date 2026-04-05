import { describe, expect, it } from "vitest";

import { extractNextBundleUrl } from "./sync-greenway-patient-encounters";

describe("extractNextBundleUrl", () => {
  it("returns url for relation next", () => {
    expect(
      extractNextBundleUrl({
        resourceType: "Bundle",
        link: [
          { relation: "self", url: "https://x/Encounter?patient=a" },
          { relation: "next", url: "https://x/Encounter?_getpages=abc" },
        ],
      }),
    ).toBe("https://x/Encounter?_getpages=abc");
  });

  it("returns null when no next", () => {
    expect(
      extractNextBundleUrl({
        resourceType: "Bundle",
        link: [{ relation: "self", url: "https://x" }],
      }),
    ).toBeNull();
  });
});
