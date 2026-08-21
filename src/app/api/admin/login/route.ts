import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createAdminSessionToken, adminSessionCookieOptions } from "@/lib/adminSession";

export async function POST(req: NextRequest) {
  const { accessToken } = await req.json().catch(() => ({}));

  if (typeof accessToken !== "string" || !accessToken) {
    return NextResponse.json({ error: "accessToken is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const token = await createAdminSessionToken({
    adminUserId: data.user.id,
    email: data.user.email ?? "",
  });

  const res = NextResponse.json({ email: data.user.email });
  res.cookies.set(adminSessionCookieOptions.name, token, adminSessionCookieOptions);
  return res;
}
