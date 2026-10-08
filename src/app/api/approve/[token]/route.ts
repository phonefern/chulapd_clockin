import { NextRequest, NextResponse } from "next/server";
import { resolveApprovalLink } from "@/lib/approvalLinks";
import { buildMonthlyReports, getLatestApprovals, recordApproval } from "@/lib/attendanceReport";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Item = { employeeId: string; documentHash: string };

// Supervisor approval through a shared link: the token is the credential, and the approver's
// name/role come from the link (set by the admin who created it), not from the request.
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const resolved = await resolveApprovalLink(supabase, token);
  if (!resolved.ok) {
    return NextResponse.json({ error: "ลิงก์นี้หมดอายุหรือถูกยกเลิกแล้ว" }, { status: 403 });
  }
  const { link } = resolved;

  const body = await req.json().catch(() => ({}));
  const items: Item[] = Array.isArray(body.items)
    ? body.items.filter(
        (i: unknown): i is Item =>
          !!i &&
          typeof (i as Item).employeeId === "string" &&
          typeof (i as Item).documentHash === "string" &&
          link.employee_ids.includes((i as Item).employeeId)
      )
    : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "กรุณาเลือกรายงานที่จะรับรอง" }, { status: 400 });
  }

  try {
    const [reports, latest] = await Promise.all([
      buildMonthlyReports(
        supabase,
        link.report_month,
        items.map((i) => i.employeeId)
      ),
      getLatestApprovals(supabase, link.report_month),
    ]);

    const results = [];
    for (const item of items) {
      const report = reports.find((r) => r.employee.id === item.employeeId);
      if (!report) {
        results.push({ employeeId: item.employeeId, ok: false, error: "ไม่พบพนักงาน" });
        continue;
      }
      const result = await recordApproval(supabase, report, item.documentHash, latest.get(item.employeeId), {
        approverName: link.approver_name,
        approverRole: link.approver_role,
        approvedBy: null,
        approverEmail: null,
        approvedVia: "link",
        approvalLinkId: link.id,
        userAgent: req.headers.get("user-agent"),
      });
      results.push(
        result.ok
          ? { employeeId: item.employeeId, ok: true, verificationId: result.approval.verification_id }
          : { employeeId: item.employeeId, ok: false, error: result.error }
      );
    }

    return NextResponse.json({ results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "รับรองไม่สำเร็จ" },
      { status: 500 }
    );
  }
}
