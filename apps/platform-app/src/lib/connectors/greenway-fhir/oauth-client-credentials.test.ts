import { generateKeyPairSync, verify as verifySignature } from "crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchGreenwayAccessTokenWithClientCredentials,
  isGreenwayFhirClientCredentialsConfigured,
} from "./oauth-client-credentials";

const keys = [
  "GREENWAY_FHIR_CLIENT_ID",
  "GREENWAY_FHIR_CLIENT_SECRET",
  "GREENWAY_FHIR_CLIENT_PRIVATE_KEY",
  "GREENWAY_FHIR_CLIENT_KEY_ID",
  "GREENWAY_FHIR_TOKEN_URL",
  "GREENWAY_FHIR_OAUTH_SCOPE",
  "GREENWAY_FHIR_CLIENT_ID__LCO",
  "GREENWAY_FHIR_CLIENT_SECRET__LCO",
  "GREENWAY_FHIR_CLIENT_PRIVATE_KEY__LCO",
  "GREENWAY_FHIR_CLIENT_KEY_ID__LCO",
  "GREENWAY_FHIR_TOKEN_URL__LCO",
] as const;

describe("isGreenwayFhirClientCredentialsConfigured", () => {
  afterEach(() => {
    for (const k of keys) {
      delete process.env[k];
    }
  });

  it("is false until id, auth material, and token URL are set", () => {
    expect(isGreenwayFhirClientCredentialsConfigured()).toBe(false);
    process.env.GREENWAY_FHIR_CLIENT_ID = "a";
    process.env.GREENWAY_FHIR_CLIENT_PRIVATE_KEY = "not-a-real-key";
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

  it("uses ES384 private_key_jwt when backend-service key material is configured", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ec", {
      namedCurve: "P-384",
    });
    process.env.GREENWAY_FHIR_CLIENT_ID = "backend-client";
    process.env.GREENWAY_FHIR_CLIENT_PRIVATE_KEY = privateKey.export({
      type: "pkcs8",
      format: "pem",
    });
    process.env.GREENWAY_FHIR_CLIENT_KEY_ID = "kid-123";
    process.env.GREENWAY_FHIR_TOKEN_URL = "https://idp.example/oauth/token";
    process.env.GREENWAY_FHIR_OAUTH_SCOPE = "system/Patient.read";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "jwt-token" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchGreenwayAccessTokenWithClientCredentials()).resolves.toBe(
      "jwt-token",
    );

    const [, init] = fetchMock.mock.calls[0] as [string, { body: URLSearchParams }];
    expect(init.body.get("client_secret")).toBeNull();
    expect(init.body.get("client_assertion_type")).toBe(
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    );
    expect(init.body.get("scope")).toBe("system/Patient.read");

    const assertion = init.body.get("client_assertion");
    expect(assertion).toBeTruthy();
    const [encodedHeader, encodedPayload, encodedSignature] = assertion!.split(".");
    const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString("utf8"));
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    expect(header).toMatchObject({ alg: "ES384", typ: "JWT", kid: "kid-123" });
    expect(payload).toMatchObject({
      iss: "backend-client",
      sub: "backend-client",
      aud: "https://idp.example/oauth/token",
    });
    expect(payload.exp - payload.iat).toBe(300);
    expect(
      verifySignature(
        "sha384",
        Buffer.from(`${encodedHeader}.${encodedPayload}`, "utf8"),
        { key: publicKey, dsaEncoding: "ieee-p1363" },
        Buffer.from(encodedSignature, "base64url"),
      ),
    ).toBe(true);
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
