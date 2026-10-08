import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Short-lived signed links for pages/files opened outside a logged-in session
// (e.g. a PDF opened in the phone's external browser from LINE, or headless Chromium rendering it).

function secret() {
  return process.env.SESSION_SECRET!;
}

function sign(scope: string, id: string, exp: number) {
  return createHmac("sha256", secret()).update(`${scope}:${id}:${exp}`).digest("base64url");
}

export function signedQuery(scope: string, id: string, ttlSeconds: number) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return new URLSearchParams({ exp: String(exp), sig: sign(scope, id, exp) }).toString();
}

export function verifySignedQuery(
  scope: string,
  id: string,
  params: { exp?: string | null; sig?: string | null }
): boolean {
  const exp = Number(params.exp);
  if (!params.sig || !Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(scope, id, exp));
  const given = Buffer.from(params.sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// Bearer tokens for supervisor approval links: random, and only their hash is stored.
export function newLinkToken() {
  return randomBytes(24).toString("base64url");
}

export function hashLinkToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
