import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import { CircleX } from "lucide-react";
import { AttendanceReportSheet } from "@/components/report/attendance-report-sheet";
import { SupervisorApproval, type SupervisorItem } from "@/components/report/supervisor-approval";
import { requestOrigin } from "@/lib/appUrl";
import { resolveApprovalLink } from "@/lib/approvalLinks";
import type { DayView } from "@/components/report/report-viewer";
import {
  ORGANIZATION_NAME,
  REPORT_STATUS_LABEL,
  approvalStateFor,
  buildMonthlyReports,
  getLatestApprovals,
  type MonthlyReport,
} from "@/lib/attendanceReport";
import { verificationQrSvg } from "@/lib/reportQr";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cn } from "@/lib/utils";

const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "รับรองรายงานเวลาปฏิบัติงาน · ChulaPD Attendance",
  robots: { index: false, follow: false },
  // The URL is the credential — don't leak it to other sites via Referer.
  referrer: "no-referrer",
};

function formatThaiMonth(month: string) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${month}-01T00:00:00+07:00`));
}

function formatThaiDate(iso: string) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

const WEEKDAY = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

function formatTime(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

function formatHours(minutes: number) {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

function dayViews(report: MonthlyReport): DayView[] {
  return report.days.map((d) => ({
    date: d.date,
    day: Number(d.date.slice(8)),
    weekday: WEEKDAY[new Date(`${d.date}T12:00:00Z`).getUTCDay()],
    clockIn: formatTime(d.clockInAt),
    clockOut: formatTime(d.clockOutAt),
    hours: d.totalMinutes === null ? null : formatHours(d.totalMinutes),
    status: d.status,
    label: REPORT_STATUS_LABEL[d.status],
    note: d.note,
  }));
}

const LINK_ERROR: Record<"not_found" | "expired" | "revoked", string> = {
  not_found: "ไม่พบลิงก์นี้ กรุณาตรวจสอบลิงก์ที่ได้รับอีกครั้ง",
  expired: "ลิงก์นี้หมดอายุแล้ว กรุณาขอลิงก์ใหม่จากผู้ดูแลระบบ",
  revoked: "ลิงก์นี้ถูกยกเลิกแล้ว กรุณาขอลิงก์ใหม่จากผู้ดูแลระบบ",
};

// Public page (no login): a supervisor reviews and approves the reports listed on the link.
export default async function SupervisorApprovePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();
  const resolved = await resolveApprovalLink(supabase, token);

  if (!resolved.ok) {
    return (
      <main className={cn(sarabun.className, "grid min-h-screen place-items-center bg-slate-100 p-6")}>
        <div className="max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
          <CircleX className="mx-auto size-10 text-rose-500" />
          <p className="mt-3 font-semibold text-slate-900">ไม่สามารถเปิดลิงก์ได้</p>
          <p className="mt-1 text-sm text-slate-600">{LINK_ERROR[resolved.reason]}</p>
        </div>
      </main>
    );
  }

  const { link } = resolved;
  const [reports, latestByEmployee, origin] = await Promise.all([
    buildMonthlyReports(supabase, link.report_month, link.employee_ids),
    getLatestApprovals(supabase, link.report_month),
    requestOrigin(),
  ]);

  const items: SupervisorItem[] = [];
  const sheets: Record<string, React.ReactNode> = {};
  for (const report of reports) {
    const latest = latestByEmployee.get(report.employee.id);
    const state = approvalStateFor(report, latest);
    const { summary } = report;
    items.push({
      employeeId: report.employee.id,
      name: report.employee.name,
      code: report.employee.code,
      state,
      documentHash: report.documentHash,
      recordedDays: summary.recordedDays,
      totalMinutes: summary.totalMinutes,
      noRecordDays: summary.noRecordDays,
      editedCount: summary.editedCount,
      warnings: [
        summary.invalidDays > 0 ? `เวลาไม่ถูกต้อง ${summary.invalidDays} วัน` : null,
        summary.incompleteDays > 0 ? `ไม่มีเวลาออก ${summary.incompleteDays} วัน` : null,
      ].filter((w): w is string => w !== null),
      summaryView: {
        recordedDays: summary.recordedDays,
        totalHours: `${formatHours(summary.totalMinutes)} ชม.`,
        noRecordDays: summary.noRecordDays,
        leaveDays: summary.leaveDays,
        editedCount: summary.editedCount,
      },
      days: dayViews(report),
    });
    const approved = state === "approved" && latest;
    sheets[report.employee.id] = (
      <AttendanceReportSheet
        report={report}
        approval={approved ? latest : null}
        qrSvg={approved ? await verificationQrSvg(origin, latest.verification_id) : null}
      />
    );
  }

  const approvedCount = items.filter((i) => i.state === "approved").length;

  return (
    <main className={cn(sarabun.className, "min-h-screen bg-slate-100")}>
      <div className="h-1.5 bg-[#1b2f55]" />
      <div className="mx-auto max-w-2xl px-4 pt-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- small static SVG */}
          <img src="/logo-mark.svg" alt="" className="size-10 rounded-xl" />
          <div>
            <p className="text-sm font-semibold text-[#1b2f55]">{ORGANIZATION_NAME}</p>
            <p className="text-xs text-slate-500">ChulaPD Attendance</p>
          </div>
        </div>

        <h1 className="mt-6 text-2xl font-bold text-slate-900">รับรองรายงานเวลาปฏิบัติงาน</h1>
        <p className="mt-1 text-slate-600">ประจำเดือน {formatThaiMonth(link.report_month)}</p>

        <div className="mt-4 rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <span className="text-slate-500">ผู้รับรอง</span>
            <span className="font-medium text-slate-900">
              {link.approver_name} · {link.approver_role}
            </span>
            <span className="text-slate-500">รายงาน</span>
            <span className="text-slate-900">
              {items.length} คน · รับรองแล้ว {approvedCount} คน
            </span>
            <span className="text-slate-500">ลิงก์ใช้ได้ถึง</span>
            <span className="text-slate-900">{formatThaiDate(link.expires_at)}</span>
          </div>
        </div>

        <div className="mt-6 pb-6">
          <SupervisorApproval
            approverName={link.approver_name}
            approverRole={link.approver_role}
            items={items}
            monthLabel={formatThaiMonth(link.report_month)}
            sheets={sheets}
            token={token}
          />
          {approvedCount === items.length && items.length > 0 && (
            <p className="mt-6 rounded-2xl bg-emerald-50 p-4 text-center text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
              รับรองครบทุกรายงานแล้ว ขอบคุณครับ/ค่ะ
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
