import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/requireSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveGeofence } from "@/lib/geofence";
import { todayInBangkok } from "@/lib/workDate";

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { lat, lng, accuracy } = await req.json().catch(() => ({}));

  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const geofence = await resolveGeofence(supabase, lat, lng);

  if (!geofence.allowed) {
    return NextResponse.json(
      { error: "อยู่นอกพื้นที่ที่กำหนด ไม่สามารถ Clock out ได้", geofence },
      { status: 403 }
    );
  }

  const workDate = todayInBangkok();

  const { data: existing } = await supabase
    .from("attendance")
    .select("id, clock_in_at, clock_out_at")
    .eq("employee_id", session.employeeId)
    .eq("work_date", workDate)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "ยังไม่ได้ Clock in วันนี้" }, { status: 400 });
  }

  if (existing.clock_out_at) {
    return NextResponse.json(
      { error: "Clock out ไปแล้ววันนี้", attendance: existing },
      { status: 409 }
    );
  }

  const clockOutAt = new Date();
  const totalMinutes = Math.round(
    (clockOutAt.getTime() - new Date(existing.clock_in_at).getTime()) / 60000
  );

  const { data: attendance, error } = await supabase
    .from("attendance")
    .update({
      clock_out_at: clockOutAt.toISOString(),
      clock_out_lat: lat,
      clock_out_lng: lng,
      clock_out_accuracy: typeof accuracy === "number" ? accuracy : null,
      clock_out_method: "geofence",
      total_minutes: totalMinutes,
      updated_at: clockOutAt.toISOString(),
    })
    .eq("id", existing.id)
    .select("id, work_date, clock_in_at, clock_out_at, total_minutes, status")
    .single();

  if (error || !attendance) {
    return NextResponse.json({ error: error?.message ?? "Clock out failed" }, { status: 500 });
  }

  return NextResponse.json({ attendance });
}
