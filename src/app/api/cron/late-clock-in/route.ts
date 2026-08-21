import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { pushLineMessage, liffUrl } from "@/lib/lineMessaging";
import { todayInBangkok } from "@/lib/workDate";

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const workDate = todayInBangkok();

  const { data: employees, error: employeesError } = await supabase
    .from("employees")
    .select("id, line_user_id, name, display_name")
    .eq("active", true)
    .not("line_user_id", "is", null);

  if (employeesError) {
    return NextResponse.json({ error: employeesError.message }, { status: 500 });
  }

  const { data: clockedIn, error: attendanceError } = await supabase
    .from("attendance")
    .select("employee_id")
    .eq("work_date", workDate)
    .not("clock_in_at", "is", null);

  if (attendanceError) {
    return NextResponse.json({ error: attendanceError.message }, { status: 500 });
  }

  const clockedInIds = new Set((clockedIn ?? []).map((row) => row.employee_id));
  const link = liffUrl();

  let sent = 0;
  for (const employee of employees ?? []) {
    if (clockedInIds.has(employee.id) || !employee.line_user_id) continue;
    try {
      await pushLineMessage(
        employee.line_user_id,
        `สวัสดีค่ะ/ครับ คุณ${employee.display_name ?? employee.name}\nวันนี้ยังไม่ได้ Clock in นะครับ กดลิงก์นี้เพื่อลงเวลา\n${link}`
      );
      sent++;
    } catch (err) {
      console.error("late-clock-in push failed for", employee.id, err);
    }
  }

  return NextResponse.json({ ok: true, checked: employees?.length ?? 0, sent });
}
