import { NextRequest, NextResponse } from "next/server";
import { LineVerifyError, verifyLineIdToken } from "@/lib/line";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createSessionToken, sessionCookieOptions } from "@/lib/session";

export async function POST(req: NextRequest) {
  const { idToken } = await req.json().catch(() => ({}));

  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "idToken is required" }, { status: 400 });
  }

  let claims;
  try {
    claims = await verifyLineIdToken(idToken);
  } catch (err) {
    if (err instanceof LineVerifyError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const supabase = getSupabaseAdmin();

  const { data: employee, error } = await supabase
    .from("employees")
    .upsert(
      { line_user_id: claims.sub, name: claims.name ?? "" },
      { onConflict: "line_user_id", ignoreDuplicates: false }
    )
    .select("id, employee_code, name, display_name, role, active")
    .single();

  if (error || !employee) {
    return NextResponse.json({ error: error?.message ?? "Failed to upsert employee" }, { status: 500 });
  }

  if (!employee.active) {
    return NextResponse.json({ error: "Account is inactive" }, { status: 403 });
  }

  const token = await createSessionToken({ employeeId: employee.id, lineUserId: claims.sub });

  const res = NextResponse.json({ employee });
  res.cookies.set(sessionCookieOptions.name, token, sessionCookieOptions);
  return res;
}
