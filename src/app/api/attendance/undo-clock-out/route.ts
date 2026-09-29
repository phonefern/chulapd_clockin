import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/requireSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { todayInBangkok } from "@/lib/workDate";
import { CLOCK_OUT_UNDO_WINDOW_MS } from "@/lib/workSchedule";

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from("attendance")
    .select("id, clock_out_at")
    .eq("employee_id", session.employeeId)
    .eq("work_date", todayInBangkok())
    .maybeSingle();

  if (!existing?.clock_out_at) {
    return NextResponse.json({ error: "ยังไม่มี Clock out ให้ยกเลิก" }, { status: 400 });
  }

  const clockOutAt = new Date(existing.clock_out_at).getTime();
  if (Date.now() - clockOutAt > CLOCK_OUT_UNDO_WINDOW_MS) {
    return NextResponse.json(
      { error: "เลยเวลายกเลิก 2 นาทีแล้ว กรุณาติดต่อผู้ดูแลระบบเพื่อแก้ไขเวลา" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const { data: attendance, error } = await supabase
    .from("attendance")
    .update({
      clock_out_at: null,
      clock_out_lat: null,
      clock_out_lng: null,
      clock_out_accuracy: null,
      clock_out_method: null,
      clock_out_note: null,
      total_minutes: null,
      updated_at: now,
    })
    .eq("id", existing.id)
    .eq("employee_id", session.employeeId)
    .select("id, work_date, clock_in_at, clock_out_at, total_minutes, status")
    .single();

  if (error || !attendance) {
    return NextResponse.json({ error: error?.message ?? "Undo failed" }, { status: 500 });
  }

  return NextResponse.json({ attendance });
}
