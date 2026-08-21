import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/requireAdminSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const EDITABLE_FIELDS = ["display_name", "employee_code", "role", "active"] as const;

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

  if (body.role !== undefined && body.role !== "employee" && body.role !== "admin") {
    return NextResponse.json({ error: "role must be 'employee' or 'admin'" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) {
      update[field] = body[field];
    }
  }

  if (typeof update.employee_code === "string" && update.employee_code.trim() === "") {
    update.employee_code = null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No editable fields provided" }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();

  const supabase = getSupabaseAdmin();
  const { data: employee, error } = await supabase
    .from("employees")
    .update(update)
    .eq("id", id)
    .select("id, employee_code, name, display_name, line_user_id, role, active, created_at")
    .single();

  if (error || !employee) {
    return NextResponse.json({ error: error?.message ?? "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ employee });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const force = req.nextUrl.searchParams.get("force") === "true";
  const supabase = getSupabaseAdmin();

  if (force) {
    const { error: adjError } = await supabase
      .from("attendance_adjustments")
      .delete()
      .eq("employee_id", id);
    if (adjError) {
      return NextResponse.json({ error: adjError.message }, { status: 500 });
    }

    const { error: attError } = await supabase
      .from("attendance")
      .delete()
      .eq("employee_id", id);
    if (attError) {
      return NextResponse.json({ error: attError.message }, { status: 500 });
    }
  }

  const { error } = await supabase.from("employees").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return NextResponse.json(
        {
          error: "ลบไม่ได้เพราะมีประวัติการลงเวลาผูกอยู่",
          hasHistory: true,
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
