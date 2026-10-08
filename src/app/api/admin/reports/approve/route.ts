import { NextRequest, NextResponse } from "next/server";
import {
  APPROVAL_COLUMNS,
  buildMonthlyReport,
  getLatestApprovals,
  newVerificationId,
  reportSnapshot,
} from "@/lib/attendanceReport";
import { getAdminSessionFromRequest } from "@/lib/requireAdminSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidWorkMonth } from "@/lib/workDate";

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { employeeId, month, documentHash } = body;
  const approverName = cleanText(body.approverName, 120);
  const approverRole = cleanText(body.approverRole, 120);

  if (typeof employeeId !== "string" || !employeeId) {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
  }
  if (typeof month !== "string" || !isValidWorkMonth(month)) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }
  if (!approverName || !approverRole) {
    return NextResponse.json({ error: "กรุณากรอกชื่อและตำแหน่งผู้รับรอง" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  let report;
  let latest;
  try {
    [report, latest] = await Promise.all([
      buildMonthlyReport(supabase, employeeId, month),
      getLatestApprovals(supabase, month, employeeId),
    ]);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "โหลดรายงานไม่สำเร็จ" },
      { status: 500 }
    );
  }

  if (!report) {
    return NextResponse.json({ error: "ไม่พบพนักงาน" }, { status: 404 });
  }
  // The admin must certify exactly what they were looking at.
  if (documentHash !== report.documentHash) {
    return NextResponse.json(
      { error: "ข้อมูลในรายงานเปลี่ยนไประหว่างตรวจสอบ กรุณาโหลดหน้าใหม่แล้วตรวจสอบอีกครั้ง" },
      { status: 409 }
    );
  }

  const previous = latest.get(employeeId);
  if (previous?.document_hash === report.documentHash) {
    return NextResponse.json({ error: "รายงานฉบับนี้ได้รับการรับรองแล้ว", approval: previous }, { status: 409 });
  }

  const { data: approval, error } = await supabase
    .from("attendance_report_approvals")
    .insert({
      verification_id: newVerificationId(report.documentNumber),
      employee_id: employeeId,
      report_month: month,
      report_version: (previous?.report_version ?? 0) + 1,
      document_hash: report.documentHash,
      snapshot: reportSnapshot(report),
      approved_by: session.adminUserId,
      approver_email: session.email || null,
      approver_name: approverName,
      approver_role: approverRole,
    })
    .select(APPROVAL_COLUMNS)
    .single();

  if (error || !approval) {
    // 23505 = unique violation: another admin approved the same version at the same moment.
    const status = error?.code === "23505" ? 409 : 500;
    return NextResponse.json(
      { error: status === 409 ? "มีผู้รับรองรายงานนี้ไปแล้ว กรุณาโหลดหน้าใหม่" : error?.message ?? "บันทึกไม่สำเร็จ" },
      { status }
    );
  }

  return NextResponse.json({ approval });
}
