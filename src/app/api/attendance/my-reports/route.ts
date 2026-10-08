import { NextRequest, NextResponse } from "next/server";
import { requestOrigin } from "@/lib/appUrl";
import { APPROVAL_COLUMNS, type ReportApproval } from "@/lib/attendanceReport";
import { getSession } from "@/lib/requireSession";
import { signedQuery } from "@/lib/signedUrl";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

// PDF links handed to the LIFF page are opened in the external browser right away.
const PDF_LINK_TTL_SECONDS = 60 * 60;

// The signed-in employee's certified reports (latest approved version per month).
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("attendance_report_approvals")
    .select(APPROVAL_COLUMNS)
    .eq("employee_id", session.employeeId)
    .order("report_month", { ascending: false })
    .order("report_version", { ascending: false })
    .limit(60);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const origin = await requestOrigin();
  const seen = new Set<string>();
  const reports = ((data ?? []) as ReportApproval[])
    .filter((approval) => !seen.has(approval.report_month) && seen.add(approval.report_month))
    .map((approval) => ({
      id: approval.id,
      month: approval.report_month,
      verificationId: approval.verification_id,
      approverName: approval.approver_name,
      approvedAt: approval.approved_at,
      version: approval.report_version,
      pdfUrl: `${origin}/api/reports/pdf/${approval.id}?${signedQuery("report-pdf", approval.id, PDF_LINK_TTL_SECONDS)}`,
    }));

  return NextResponse.json({ reports });
}
