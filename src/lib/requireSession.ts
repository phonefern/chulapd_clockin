import { NextRequest } from "next/server";
import { verifySessionToken, sessionCookieOptions, SessionPayload } from "./session";

export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(sessionCookieOptions.name)?.value;
  if (!token) return null;
  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}
