import { NextResponse } from "next/server";
import { adminSessionCookieOptions } from "@/lib/adminSession";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminSessionCookieOptions.name, "", {
    ...adminSessionCookieOptions,
    maxAge: 0,
  });
  return res;
}
