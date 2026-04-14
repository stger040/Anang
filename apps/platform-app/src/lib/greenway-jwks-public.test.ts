import { describe, expect, it } from "vitest";

import { validateGreenwayPublicJwksJson } from "./greenway-jwks-public";

describe("validateGreenwayPublicJwksJson", () => {
  it("accepts minimal valid P-384 public JWK set", () => {
    const doc = {
      keys: [
        {
          kty: "EC",
          crv: "P-384",
          kid: "test-1",
          use: "sig",
          alg: "ES384",
          x: "REPLACEME_x_base64url_coordinate",
          y: "REPLACEME_y_base64url_coordinate",
        },
      ],
    };
    const r = validateGreenwayPublicJwksJson(JSON.stringify(doc));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(JSON.parse(r.normalizedJson)).toEqual(doc);
    }
  });

  it("rejects private field d", () => {
    const r = validateGreenwayPublicJwksJson(
      JSON.stringify({
        keys: [
          {
            kty: "EC",
            crv: "P-384",
            x: "a",
            y: "b",
            d: "secret",
          },
        ],
      }),
    );
    expect(r.ok).toBe(false);
  });

  it("rejects wrong curve", () => {
    const r = validateGreenwayPublicJwksJson(
      JSON.stringify({
        keys: [{ kty: "EC", crv: "P-256", x: "a", y: "b" }],
      }),
    );
    expect(r.ok).toBe(false);
  });
});
