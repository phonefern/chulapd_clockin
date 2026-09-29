import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/requireAdminSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

type AttendanceBefore = {
  id: string;
  work_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  total_minutes: number | null;
};

function parseEditableTime(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !TIME_PATTERN.test(value)) {
    throw new Error("เวลาต้องอยู่ในรูปแบบ HH:mm");
  }
  return value;
}

function toBangkokIso(workDate: string, time: string | null): string | null {
  if (!time) return null;
  return new Date(`${workDate}T${time}:00+07:00`).toISOString();
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  let clockInTime: string | null;
  let clockOutTime: string | null;
  try {
    clockInTime = parseEditableTime(body.clockInTime);
    clockOutTime = parseEditableTime(body.clockOutTime);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "รูปแบบเวลาไม่ถูกต้อง" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: existingData, error: existingError } = await supabase
    .from("attendance")
    .select("id, work_date, clock_in_at, clock_out_at, total_minutes")
    .eq("id", id)
    .single();

  if (existingError || !existingData) {
    return NextResponse.json(
      { error: existingError?.message ?? "ไม่พบรายการลงเวลา" },
      { status: existingError?.code === "PGRST116" ? 404 : 500 }
    );
  }

  const existing = existingData as AttendanceBefore;
  const clockInAt = toBangkokIso(existing.work_date, clockInTime);
  const clockOutAt = toBangkokIso(existing.work_date, clockOutTime);

  if (clockInAt && clockOutAt && new Date(clockOutAt).getTime() < new Date(clockInAt).getTime()) {
    return NextResponse.json(
      { error: "เวลาออกต้องไม่เร็วกว่าเวลาเข้า" },
      { status: 400 }
    );
  }

  const totalMinutes =
    clockInAt && clockOutAt
      ? Math.round((new Date(clockOutAt).getTime() - new Date(clockInAt).getTime()) / 60000)
      : null;
  const updatedAt = new Date().toISOString();
  const oldValue = {
    clock_in_at: existing.clock_in_at,
    clock_out_at: existing.clock_out_at,
    total_minutes: existing.total_minutes,
  };
  const newValue = {
    clock_in_at: clockInAt,
    clock_out_at: clockOutAt,
    total_minutes: totalMinutes,
  };

  const { data: updated, error: updateError } = await supabase
    .from("attendance")
    .update({
      clock_in_at: clockInAt,
      clock_out_at: clockOutAt,
      total_minutes: totalMinutes,
      updated_at: updatedAt,
      ...(clockOutAt ? {} : { clock_out_method: null, clock_out_note: null }),
    })
    .eq("id", id)
    .select("id, work_date, clock_in_at, clock_out_at, total_minutes, status")
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: updateError?.message ?? "แก้ไขเวลาไม่สำเร็จ" },
      { status: 500 }
    );
  }

  const { error: auditError } = await supabase.from("audit_logs").insert({
    user_id: session.adminUserId,
    action: "admin_edit_attendance",
    entity_type: "attendance",
    entity_id: id,
    old_value: oldValue,
    new_value: newValue,
  });

  if (auditError) {
    // The attendance row is already updated at this point — don't report failure
    // to the admin for a bookkeeping write. Log server-side so it isn't silent.
    console.error("Failed to write audit_logs for attendance edit", id, auditError);
  }

  return NextResponse.json({ attendance: updated });
}
