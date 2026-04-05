import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchGreenwayAccessTokenWithClientCredentials,
  isGreenwayFhirClientCredentialsConfigured,
} from "./oauth-client-credentials";

const keys = [
  "GREENWAY_FHIR_CLIENT_ID",
  "GREENWAY_FHIR_CLIENT_SECRET",
  "GREENWAY_FHIR_TOKEN_URL",
  "GREENWAY_FHIR_OAUTH_SCOPE",
  "GREENWAY_FHIR_CLIENT_ID__LCO",
  "GREENWAY_FHIR_CLIENT_SECRET__LCO",
  "GREENWAY_FHIR_TOKEN_URL__LCO",
] as const;

describe("isGreenwayFhirClientCredentialsConfigured", () => {
  afterEach(() => {
    for (const k of keys) {
      delete process.env[k];
    }
  });

  it("is false until id, secret, and token URL are set", () => {
    expect(isGreenwayFhirClientCredentialsConfigured()).toBe(false);
    process.env.GREENWAY_FHIR_CLIENT_ID = "a";
    process.env.GREENWAY_FHIR_CLIENT_SECRET = "b";
    expect(isGreenwayFhirClientCredentialsConfigured()).toBe(false);
    process.env.GREENWAY_FHIR_TOKEN_URL = "https://oauth.example/token";
    expect(isGreenwayFhirClientCredentialsConfigured()).toBe(true);
  });
});

describe("fetchGreenwayAccessTokenWithClientCredentials", () => {
  afterEach(() => {
    for (const k of keys) {
      delete process.env[k];
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns null when credentials incomplete", async () => {
    process.env.GREENWAY_FHIR_CLIENT_ID = "id";
    process.env.GREENWAY_FHIR_CLIENT_SECRET = "sec";
    await expect(fetchGreenwayAccessTokenWithClientCredentials()).resolves.toBeNull();
  });

  it("POSTs form body and returns access_token", async () => {
    process.env.GREENWAY_FHIR_CLIENT_ID = "cid";
    process.env.GREENWAY_FHIR_CLIENT_SECRET = "csecret";
    process.env.GREENWAY_FHIR_TOKEN_URL = "https://idp.example/oauth/token";
    process.env.GREENWAY_FHIR_OAUTH_SCOPE = "system/*.read";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "tok-abc", expires_in: 3600 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchGreenwayAccessTokenWithClientCredentials()).resolves.toBe(
      "tok-abc",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; body: URLSearchParams },
    ];
    expect(url).toBe("https://idp.example/oauth/token");
    expect(init.method).toBe("POST");
    expect(init.body.get("grant_type")).toBe("client_credentials");
    expect(init.body.get("client_id")).toBe("cid");
    expect(init.body.get("client_secret")).toBe("csecret");
    expect(init.body.get("scope")).toBe("system/*.read");
  });

  it("returns null on non-OK response", async () => {
    process.env.GREENWAY_FHIR_CLIENT_ID = "cid";
    process.env.GREENWAY_FHIR_CLIENT_SECRET = "csecret";
    process.env.GREENWAY_FHIR_TOKEN_URL = "https://idp.example/oauth/token";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );

    await expect(fetchGreenwayAccessTokenWithClientCredentials()).resolves.toBeNull();
  });

  it("uses suffixed OAuth env when present", async () => {
    process.env.GREENWAY_FHIR_CLIENT_ID = "global-id";
    process.env.GREENWAY_FHIR_CLIENT_ID__LCO = "lco-id";
    process.env.GREENWAY_FHIR_CLIENT_SECRET__LCO = "lco-sec";
    process.env.GREENWAY_FHIR_TOKEN_URL__LCO = "https://idp.lco/token";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "from-lco" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { fetchGreenwayAccessTokenForSuffix } = await import(
      "./oauth-client-credentials"
    );
    await expect(fetchGreenwayAccessTokenForSuffix("LCO")).resolves.toBe(
      "from-lco",
    );
    const [, init] = fetchMock.mock.calls[0] as [string, { body: URLSearchParams }];
    expect(init.body.get("client_id")).toBe("lco-id");
  });
});
