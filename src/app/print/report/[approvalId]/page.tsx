import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import { notFound } from "next/navigation";
import { AttendanceReportSheet } from "@/components/report/attendance-report-sheet";
import { requestOrigin } from "@/lib/appUrl";
import { APPROVAL_COLUMNS, reportFromSnapshot, type ReportApproval } from "@/lib/attendanceReport";
import { verificationQrSvg } from "@/lib/reportQr";
import { verifySignedQuery } from "@/lib/signedUrl";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "รายงานรับรองเวลาปฏิบัติงาน",
  robots: { index: false, follow: false },
};

// Bare certified sheet rendered from the approval snapshot. Opened only by the PDF renderer,
// via a short-lived signed URL (no session cookie in headless Chromium).
export default async function PrintReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ approvalId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { approvalId } = await params;
  const query = await searchParams;
  const exp = typeof query.exp === "string" ? query.exp : null;
  const sig = typeof query.sig === "string" ? query.sig : null;
  if (!verifySignedQuery("report-print", approvalId, { exp, sig })) notFound();

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("attendance_report_approvals")
    .select(`${APPROVAL_COLUMNS}, snapshot`)
    .eq("id", approvalId)
    .maybeSingle();
  if (!data) notFound();

  const approval = data as ReportApproval & { snapshot: Parameters<typeof reportFromSnapshot>[0] };
  const report = reportFromSnapshot(approval.snapshot, approval.document_hash);
  const qrSvg = await verificationQrSvg(await requestOrigin(), approval.verification_id);

  return (
    <main className={`${sarabun.className} bg-white`}>
      <style>{`@page { size: A4 landscape; margin: 0; } html, body { background: #fff !important; }`}</style>
      <AttendanceReportSheet report={report} approval={approval} qrSvg={qrSvg} />
    </main>
  );
}
