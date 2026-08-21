import { SignJWT, jwtVerify } from "jose";

const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

export type AdminSessionPayload = {
  adminUserId: string;
  email: string;
};

function secretKey() {
  return new TextEncoder().encode(process.env.SESSION_SECRET!);
}

export async function createAdminSessionToken(payload: AdminSessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifyAdminSessionToken(token: string): Promise<AdminSessionPayload> {
  const { payload } = await jwtVerify(token, secretKey());
  return payload as unknown as AdminSessionPayload;
}

export const adminSessionCookieOptions = {
  name: "admin_session",
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const, // opened directly in a normal browser, not LIFF's cross-site webview
  path: "/",
  maxAge: ADMIN_SESSION_TTL_SECONDS,
};
