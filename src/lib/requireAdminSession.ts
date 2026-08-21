import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  verifyAdminSessionToken,
  adminSessionCookieOptions,
  AdminSessionPayload,
} from "./adminSession";

export async function getAdminSession(): Promise<AdminSessionPayload | null> {
  const store = await cookies();
  const token = store.get(adminSessionCookieOptions.name)?.value;
  if (!token) return null;
  try {
    return await verifyAdminSessionToken(token);
  } catch {
    return null;
  }
}

export async function getAdminSessionFromRequest(
  req: NextRequest
): Promise<AdminSessionPayload | null> {
  const token = req.cookies.get(adminSessionCookieOptions.name)?.value;
  if (!token) return null;
  try {
    return await verifyAdminSessionToken(token);
  } catch {
    return null;
  }
}
