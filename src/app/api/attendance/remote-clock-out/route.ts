import { NextRequest, NextResponse } from "next/server";
import {
  earliestRemoteClockOutDate,
  getOpenAttendanceRows,
  getRemoteClockOutQuota,
} from "@/lib/remoteClockOut";
import { getSession } from "@/lib/requireSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { currentMonthInBangkok } from "@/lib/workDate";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Open days the employee can still close remotely, plus this month's remaining quota.
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  try {
    const [quota, openRows] = await Promise.all([
      getRemoteClockOutQuota(supabase, session.employeeId, currentMonthInBangkok()),
      getOpenAttendanceRows(supabase, session.employeeId),
    ]);
    return NextResponse.json({ quota, openRows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load remote clock-out state" },
      { status: 500 }
    );
  }
}

// Closes an open day with a self-reported clock-out time, without the geofence check.
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { attendanceId, time, note, lat, lng, accuracy } = await req.json().catch(() => ({}));

  if (typeof attendanceId !== "string" || !attendanceId) {
    return NextResponse.json({ error: "attendanceId is required" }, { status: 400 });
  }
  if (typeof time !== "string" || !TIME_PATTERN.test(time)) {
    return NextResponse.json({ error: "เวลาต้องอยู่ในรูปแบบ HH:mm" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: existing, error: existingError } = await supabase
    .from("attendance")
    .select("id, work_date, clock_in_at, clock_out_at")
    .eq("id", attendanceId)
    .eq("employee_id", session.employeeId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }
  if (!existing?.clock_in_at) {
    return NextResponse.json({ error: "ไม่พบรายการลงเวลาเข้างาน" }, { status: 404 });
  }
  if (existing.clock_out_at) {
    return NextResponse.json({ error: "วันนี้ Clock out ไปแล้ว" }, { status: 409 });
  }
  if (existing.work_date < earliestRemoteClockOutDate()) {
    return NextResponse.json(
      { error: "ย้อนหลังเกินกำหนด กรุณาติดต่อผู้ดูแลระบบเพื่อแก้ไขเวลา" },
      { status: 400 }
    );
  }

  const clockInAt = new Date(existing.clock_in_at);
  const clockOutAt = new Date(`${existing.work_date}T${time}:00+07:00`);
  if (clockOutAt.getTime() <= clockInAt.getTime()) {
    return NextResponse.json({ error: "เวลาออกต้องหลังเวลาเข้างาน" }, { status: 400 });
  }
  if (clockOutAt.getTime() > Date.now()) {
    return NextResponse.json({ error: "เวลาออกต้องไม่เกินเวลาปัจจุบัน" }, { status: 400 });
  }

  let quota;
  try {
    quota = await getRemoteClockOutQuota(
      supabase,
      session.employeeId,
      existing.work_date.slice(0, 7)
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to check quota" },
      { status: 500 }
    );
  }
  if (quota.remaining <= 0) {
    return NextResponse.json(
      {
        error: `ใช้สิทธิ์ลงเวลาออกนอกพื้นที่ครบ ${quota.limit} ครั้งของเดือนนี้แล้ว กรุณาติดต่อผู้ดูแลระบบ`,
        quota,
      },
      { status: 403 }
    );
  }

  const { data: attendance, error } = await supabase
    .from("attendance")
    .update({
      clock_out_at: clockOutAt.toISOString(),
      clock_out_lat: typeof lat === "number" ? lat : null,
      clock_out_lng: typeof lng === "number" ? lng : null,
      clock_out_accuracy: typeof accuracy === "number" ? accuracy : null,
      clock_out_method: "remote",
      clock_out_note: typeof note === "string" && note.trim() !== "" ? note.trim().slice(0, 200) : null,
      total_minutes: Math.round((clockOutAt.getTime() - clockInAt.getTime()) / 60000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .is("clock_out_at", null)
    .select("id, work_date, clock_in_at, clock_out_at, total_minutes, status")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!attendance) {
    return NextResponse.json({ error: "วันนี้ Clock out ไปแล้ว" }, { status: 409 });
  }

  return NextResponse.json({
    attendance,
    quota: { ...quota, used: quota.used + 1, remaining: quota.remaining - 1 },
  });
}
