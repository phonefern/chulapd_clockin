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
      { error: "อยู่นอกพื้นที่ที่กำหนด ไม่สามารถ Clock in ได้", geofence },
      { status: 403 }
    );
  }

  const workDate = todayInBangkok();

  const { data: existing } = await supabase
    .from("attendance")
    .select("id, clock_in_at")
    .eq("employee_id", session.employeeId)
    .eq("work_date", workDate)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Clock in ไปแล้ววันนี้", attendance: existing },
      { status: 409 }
    );
  }

  const { data: attendance, error } = await supabase
    .from("attendance")
    .insert({
      employee_id: session.employeeId,
      work_date: workDate,
      clock_in_at: new Date().toISOString(),
      clock_in_lat: lat,
      clock_in_lng: lng,
      clock_in_accuracy: typeof accuracy === "number" ? accuracy : null,
      status: "normal",
    })
    .select("id, work_date, clock_in_at, clock_out_at, status")
    .single();

  if (error || !attendance) {
    return NextResponse.json({ error: error?.message ?? "Clock in failed" }, { status: 500 });
  }

  return NextResponse.json({ attendance });
}
