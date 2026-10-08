import { NextRequest, NextResponse } from "next/server";
import { requestOrigin } from "@/lib/appUrl";
import { approvalStateFor, buildMonthlyReports, getLatestApprovals } from "@/lib/attendanceReport";
import { liffUrl, pushLineMessages } from "@/lib/lineMessaging";
import { certifiedReportFlex } from "@/lib/reportLineMessage";
import { getAdminSessionFromRequest } from "@/lib/requireAdminSession";
import { signedQuery } from "@/lib/signedUrl";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidWorkMonth } from "@/lib/workDate";

// The PDF link in a LINE message stays usable for a month; the LIFF "my reports" page
// always issues fresh links after that.
const PDF_LINK_TTL_SECONDS = 30 * 24 * 60 * 60;

type Skipped = { name: string; reason: string };

// Pushes each selected employee's certified report to them on LINE (1 message each — counts
// against the LINE OA monthly quota). Only reports whose current data matches the approval are sent.
export async function POST(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { month, employeeIds } = body;
  if (typeof month !== "string" || !isValidWorkMonth(month)) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }
  if (employeeIds !== undefined && !(Array.isArray(employeeIds) && employeeIds.every((id) => typeof id === "string"))) {
    return NextResponse.json({ error: "employeeIds must be a list" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const origin = await requestOrigin();
  const myReportsUrl = `${liffUrl()}?view=reports`;

  try {
    const [reports, latestByEmployee, employeesRes] = await Promise.all([
      buildMonthlyReports(supabase, month, employeeIds),
      getLatestApprovals(supabase, month),
      supabase.from("employees").select("id, line_user_id, active"),
    ]);
    if (employeesRes.error) throw new Error(employeesRes.error.message);
    const lineUserById = new Map(
      (employeesRes.data ?? []).map((e) => [e.id as string, e.active ? (e.line_user_id as string | null) : null])
    );

    let sent = 0;
    const skipped: Skipped[] = [];
    for (const report of reports) {
      const name = report.employee.name;
      const approval = latestByEmployee.get(report.employee.id);
      const state = approvalStateFor(report, approval);
      const lineUserId = lineUserById.get(report.employee.id);

      if (!approval || state !== "approved") {
        skipped.push({ name, reason: state === "stale" ? "ข้อมูลเปลี่ยนหลังรับรอง" : "ยังไม่ได้รับรอง" });
        continue;
      }
      if (!lineUserId) {
        skipped.push({ name, reason: "ไม่มีบัญชี LINE" });
        continue;
      }

      const pdfUrl = `${origin}/api/reports/pdf/${approval.id}?${signedQuery("report-pdf", approval.id, PDF_LINK_TTL_SECONDS)}`;
      try {
        await pushLineMessages(lineUserId, [certifiedReportFlex(report, approval, pdfUrl, myReportsUrl)]);
        sent++;
        await supabase
          .from("attendance_report_approvals")
          .update({ sent_to_employee_at: new Date().toISOString() })
          .eq("id", approval.id);
      } catch (err) {
        console.error("send certified report failed", report.employee.id, err);
        const message = err instanceof Error ? err.message : String(err);
        skipped.push({ name, reason: message.includes("429") ? "โควตาข้อความ LINE เต็ม" : "ส่ง LINE ไม่สำเร็จ" });
      }
    }

    return NextResponse.json({ sent, skipped });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ส่งรายงานไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
