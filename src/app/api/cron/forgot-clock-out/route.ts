import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { pushLineMessage, liffUrl } from "@/lib/lineMessaging";
import { todayInBangkok } from "@/lib/workDate";

type EmployeeInfo = {
  line_user_id: string | null;
  name: string;
  display_name: string | null;
  active: boolean;
};

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const workDate = todayInBangkok();

  const { data: rows, error } = await supabase
    .from("attendance")
    .select("employee_id, employees(line_user_id, name, display_name, active)")
    .eq("work_date", workDate)
    .not("clock_in_at", "is", null)
    .is("clock_out_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const link = liffUrl();
  let sent = 0;

  for (const row of rows ?? []) {
    const employee = row.employees as unknown as EmployeeInfo | null;
    if (!employee || !employee.active || !employee.line_user_id) continue;
    try {
      await pushLineMessage(
        employee.line_user_id,
        `สวัสดีค่ะ/ครับ คุณ${employee.display_name ?? employee.name}\nวันนี้ Clock in แล้วแต่ยังไม่ได้ Clock out นะครับ กดลิงก์นี้เพื่อลงเวลาออก\n${link}`
      );
      sent++;
    } catch (err) {
      console.error("forgot-clock-out push failed for", row.employee_id, err);
    }
  }

  return NextResponse.json({ ok: true, checked: rows?.length ?? 0, sent });
}
