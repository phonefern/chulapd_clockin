import { SignJWT, jwtVerify } from "jose";

const SESSION_COOKIE = "attendance_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h, re-issued on each LIFF open

export type SessionPayload = {
  employeeId: string;
  lineUserId: string;
};

function secretKey() {
  return new TextEncoder().encode(process.env.SESSION_SECRET!);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, secretKey());
  return payload as unknown as SessionPayload;
}

export const sessionCookieOptions = {
  name: SESSION_COOKIE,
  httpOnly: true,
  secure: true,
  sameSite: "none" as const, // LIFF runs inside LINE's in-app browser (cross-site context)
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
