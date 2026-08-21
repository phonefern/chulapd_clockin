import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/requireSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { todayInBangkok } from "@/lib/workDate";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: attendance } = await supabase
    .from("attendance")
    .select("id, work_date, clock_in_at, clock_out_at, total_minutes, status")
    .eq("employee_id", session.employeeId)
    .eq("work_date", todayInBangkok())
    .maybeSingle();

  return NextResponse.json({ attendance: attendance ?? null });
}
