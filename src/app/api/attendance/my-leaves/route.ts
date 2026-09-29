import { NextRequest, NextResponse } from "next/server";
import { LEAVE_COLUMNS, parseLeaveInput } from "@/lib/leaves";
import { getSession } from "@/lib/requireSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { todayInBangkok } from "@/lib/workDate";

// The signed-in employee's leaves that haven't ended yet.
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("employee_leaves")
    .select(LEAVE_COLUMNS)
    .eq("employee_id", session.employeeId)
    .gte("end_date", todayInBangkok())
    .order("start_date", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ leaves: data, today: todayInBangkok() });
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const input = parseLeaveInput(await req.json().catch(() => ({})));
  if ("error" in input) {
    return NextResponse.json({ error: input.error }, { status: 400 });
  }
  if (input.start_date < todayInBangkok()) {
    return NextResponse.json(
      { error: "แจ้งลาย้อนหลังไม่ได้ กรุณาติดต่อผู้ดูแลระบบ" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: leave, error } = await supabase
    .from("employee_leaves")
    .insert({ employee_id: session.employeeId, ...input, created_by: "employee" })
    .select(LEAVE_COLUMNS)
    .single();

  if (error || !leave) {
    return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  }

  return NextResponse.json({ leave });
}
