import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/requireAdminSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidWorkDate, todayInBangkok } from "@/lib/workDate";

const LEAVE_PERIODS = ["full", "morning", "afternoon"] as const;
const LEAVE_COLUMNS = "id, employee_id, start_date, end_date, period, note, created_at";

// Lists leaves that haven't ended yet (today onward), optionally for a single employee.
export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const employeeId = req.nextUrl.searchParams.get("employee");
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("employee_leaves")
    .select(LEAVE_COLUMNS)
    .gte("end_date", todayInBangkok())
    .order("start_date", { ascending: true });

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leaves: data });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { employee_id, start_date, end_date, period = "full", note } = body;

  if (typeof employee_id !== "string" || !employee_id) {
    return NextResponse.json({ error: "employee_id is required" }, { status: 400 });
  }
  if (typeof start_date !== "string" || !isValidWorkDate(start_date)) {
    return NextResponse.json({ error: "start_date must be YYYY-MM-DD" }, { status: 400 });
  }
  const endDate = end_date === undefined || end_date === "" ? start_date : end_date;
  if (typeof endDate !== "string" || !isValidWorkDate(endDate)) {
    return NextResponse.json({ error: "end_date must be YYYY-MM-DD" }, { status: 400 });
  }
  if (endDate < start_date) {
    return NextResponse.json({ error: "วันสิ้นสุดต้องไม่ก่อนวันเริ่มลา" }, { status: 400 });
  }
  if (!LEAVE_PERIODS.includes(period)) {
    return NextResponse.json({ error: "period must be full, morning or afternoon" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: leave, error } = await supabase
    .from("employee_leaves")
    .insert({
      employee_id,
      start_date,
      end_date: endDate,
      period,
      note: typeof note === "string" && note.trim() !== "" ? note.trim() : null,
    })
    .select(LEAVE_COLUMNS)
    .single();

  if (error || !leave) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ leave });
}
