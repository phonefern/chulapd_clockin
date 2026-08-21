import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, sessionCookieOptions } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(sessionCookieOptions.name)?.value;
  if (!token) {
    return NextResponse.json({ employee: null }, { status: 200 });
  }

  try {
    const session = await verifySessionToken(token);
    const supabase = getSupabaseAdmin();
    const { data: employee } = await supabase
      .from("employees")
      .select("id, employee_code, name, display_name, role, active")
      .eq("id", session.employeeId)
      .single();

    return NextResponse.json({ employee: employee ?? null });
  } catch {
    return NextResponse.json({ employee: null }, { status: 200 });
  }
}
