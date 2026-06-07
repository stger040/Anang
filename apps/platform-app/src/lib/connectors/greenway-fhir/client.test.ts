import { afterEach, describe, expect, it, vi } from "vitest";

import { greenwayFhirGetFhirHref } from "./client";
import type { GreenwayFhirEnvConfig } from "./env";

const config: GreenwayFhirEnvConfig = {
  baseUrl: "https://fhir-api.example.com/fhir/R4/tenant-a",
  accessToken: "tok-secret",
};

describe("greenwayFhirGetFhirHref", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fetches same-origin absolute Bundle links with the Bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ resourceType: "Bundle" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      greenwayFhirGetFhirHref(
        config,
        "https://fhir-api.example.com/fhir/R4/tenant-a/Encounter?page=2",
      ),
    ).resolves.toMatchObject({ ok: true, status: 200 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toBe(
      "https://fhir-api.example.com/fhir/R4/tenant-a/Encounter?page=2",
    );
    expect(init.headers.authorization).toBe("Bearer tok-secret");
  });

  it("rejects cross-origin absolute Bundle links before sending the Bearer token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      greenwayFhirGetFhirHref(
        config,
        "https://attacker.example.net/collect?page=2",
      ),
    ).rejects.toThrow("refusing cross-origin FHIR Bundle link");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
