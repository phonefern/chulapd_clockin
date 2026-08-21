import { NextRequest, NextResponse } from "next/server";
import { getEmployeeMonthSummary } from "@/lib/attendanceStats";
import { getSession } from "@/lib/requireSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { currentMonthInBangkok, resolveWorkMonth } from "@/lib/workDate";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const requestedMonth = resolveWorkMonth(req.nextUrl.searchParams.get("month") ?? undefined);
  const currentMonth = currentMonthInBangkok();
  const supabase = getSupabaseAdmin();

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("created_at")
    .eq("id", session.employeeId)
    .maybeSingle();

  if (employeeError) {
    return NextResponse.json({ error: employeeError.message }, { status: 500 });
  }

  const joinMonth =
    typeof employee?.created_at === "string" ? employee.created_at.slice(0, 7) : currentMonth;
  const month = requestedMonth < joinMonth ? joinMonth : requestedMonth > currentMonth ? currentMonth : requestedMonth;

  try {
    const summary = await getEmployeeMonthSummary(supabase, session.employeeId, month);
    return NextResponse.json({ month, currentMonth, joinMonth, summary });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load stats" },
      { status: 500 }
    );
  }
}
