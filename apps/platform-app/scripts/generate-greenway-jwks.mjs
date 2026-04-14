#!/usr/bin/env node
/**
 * Generate an ES384 (P-384) keypair for Greenway backend-service JWT signing.
 *
 * Outputs a public JWKS document suitable for GREENWAY_JWKS_JSON (Vercel env).
 * Optionally writes the PKCS#8 private key to a file — never commit that file.
 *
 * Usage:
 *   node scripts/generate-greenway-jwks.mjs
 *   node scripts/generate-greenway-jwks.mjs --private-key-out C:\secrets\greenway-es384-private.pem
 */

import { generateKeyPairSync, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  let privateKeyOut = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--private-key-out" && argv[i + 1]) {
      privateKeyOut = argv[i + 1];
      i += 1;
    }
  }
  return { privateKeyOut };
}

const { privateKeyOut } = parseArgs(process.argv);

const kid = `anang-greenway-${randomBytes(8).toString("hex")}`;
const { publicKey, privateKey } = generateKeyPairSync("ec", {
  namedCurve: "P-384",
});

/** @type {import('node:crypto').JsonWebKey} */
const pubJwk = publicKey.export({ format: "jwk" });
const jwk = {
  ...pubJwk,
  kid,
  use: "sig",
  alg: "ES384",
};
const jwks = { keys: [jwk] };

const jwksLine = JSON.stringify(jwks);

console.log("");
console.log("=== Public JWKS (safe for GREENWAY_JWKS_JSON in Vercel) ===");
console.log(jwksLine);
console.log("");
console.log("Greenway JWKS URL after deploy: https://app.anang.ai/.well-known/jwks.json");
console.log("");

if (privateKeyOut) {
  const abs = path.resolve(privateKeyOut);
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, pem, "utf8");
  console.log(`Private key written to: ${abs}`);
  console.log("Store this file in a secrets manager — do NOT commit it.");
} else {
  console.log("Private key was not written. To save PKCS#8 PEM:");
  console.log(
    "  node scripts/generate-greenway-jwks.mjs --private-key-out /secure/path/greenway-es384-private.pem",
  );
  console.log(
    "When signing JWTs for Greenway, load that PEM server-side (env or secret store), not from git.",
  );
}
console.log("");
