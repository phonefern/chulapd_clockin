import type { Metadata } from "next";
import Link from "next/link";
import { Sarabun } from "next/font/google";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, CircleCheck } from "lucide-react";
import { PrintButton } from "@/components/admin/print-button";
import { ApproveReportButton } from "@/components/report/approve-report-button";
import { AttendanceReportSheet } from "@/components/report/attendance-report-sheet";
import { buttonVariants } from "@/components/ui/button";
import { requestOrigin } from "@/lib/appUrl";
import {
  approvalStateFor,
  buildMonthlyReports,
  getLatestApprovals,
  type MonthlyReport,
  type ReportApproval,
} from "@/lib/attendanceReport";
import { getAdminSession } from "@/lib/requireAdminSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cn } from "@/lib/utils";
import { addWorkMonths, resolveWorkMonth } from "@/lib/workDate";

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "รายงานรับรองเวลาปฏิบัติงาน · ChulaPD Attendance",
};

type EmployeeOption = {
  id: string;
  employee_code: string | null;
  name: string;
  display_name: string | null;
};

type SheetData = {
  report: MonthlyReport;
  latest: ReportApproval | undefined;
  qrSvg: string | null;
};

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatThaiMonth(month: string) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${month}-01T00:00:00+07:00`));
}

function reportHref(month: string, employee: string) {
  return `/admin/export/report?${new URLSearchParams({ month, employee }).toString()}`;
}

export default async function AttendanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const params = await searchParams;
  const month = resolveWorkMonth(params.month);
  const supabase = getSupabaseAdmin();

  const { data: employeesData, error: employeesError } = await supabase
    .from("employees")
    .select("id, employee_code, name, display_name")
    .eq("active", true)
    .order("employee_code", { ascending: true });
  const employees = (employeesData ?? []) as EmployeeOption[];

  const employeeParam = scalar(params.employee) ?? "all";
  const printAll = employeeParam === "all";
  const selected = printAll ? null : employees.find((e) => e.id === employeeParam) ?? null;

  let sheets: SheetData[] = [];
  let errorMessage = employeesError?.message ?? null;
  if (!employeesError) {
    try {
      const origin = await requestOrigin();
      const [reports, latestByEmployee] = await Promise.all([
        printAll || selected
          ? buildMonthlyReports(supabase, month, printAll ? undefined : [selected!.id])
          : Promise.resolve([] as MonthlyReport[]),
        getLatestApprovals(supabase, month),
      ]);
      sheets = await Promise.all(
        reports.map(async (report) => {
            const latest = latestByEmployee.get(report.employee.id);
            const approved = approvalStateFor(report, latest) === "approved";
            const qrSvg =
              approved && latest
                ? await QRCode.toString(`${origin}/verify/${latest.verification_id}`, {
                    type: "svg",
                    margin: 0,
                    errorCorrectionLevel: "M",
                    color: { dark: "#1b2f55", light: "#ffffff" },
                  })
                : null;
          return { report, latest, qrSvg };
        })
      );
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "โหลดรายงานไม่สำเร็จ";
    }
  }

  const single = !printAll && sheets.length === 1 ? sheets[0] : null;
  const singleState = single ? approvalStateFor(single.report, single.latest) : null;

  return (
    <main className="min-h-screen bg-slate-100 pb-12 print:bg-white print:pb-0">
      {/* Print: A4 landscape, zero page margin so the browser has no room for its own
          header/footer (URL, date, page number); the sheet carries its own padding. */}
      <style>{`@page { size: A4 landscape; margin: 0; } @media print { html, body { background: #fff !important; } }`}</style>

      <div className="sticky top-[57px] z-20 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-[297mm] flex-wrap items-center gap-3 px-4 py-3">
          <Link
            href={`/admin/export?month=${month}`}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
          >
            <ArrowLeft className="size-4" />
            กลับ
          </Link>

          <div className="flex items-center gap-1">
            <Link
              aria-label="เดือนก่อนหน้า"
              href={reportHref(addWorkMonths(month, -1), employeeParam)}
              className={buttonVariants({ variant: "outline", size: "icon-sm" })}
            >
              <ChevronLeft className="size-4" />
            </Link>
            <span className="min-w-28 text-center text-sm font-semibold">{formatThaiMonth(month)}</span>
            <Link
              aria-label="เดือนถัดไป"
              href={reportHref(addWorkMonths(month, 1), employeeParam)}
              className={buttonVariants({ variant: "outline", size: "icon-sm" })}
            >
              <ChevronRight className="size-4" />
            </Link>
          </div>

          <form className="flex items-center gap-2">
            <input type="hidden" name="month" value={month} />
            <select
              aria-label="พนักงาน"
              className="h-8 max-w-60 rounded-lg border border-input bg-background px-2.5 text-sm"
              defaultValue={printAll ? "all" : selected?.id}
              name="employee"
            >
              <option value="all">ทุกคน (พิมพ์รวม {employees.length} หน้า)</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.employee_code ? `${employee.employee_code} · ` : ""}
                  {employee.display_name ?? employee.name}
                </option>
              ))}
            </select>
            <button className={buttonVariants({ variant: "outline", size: "sm" })} type="submit">
              แสดง
            </button>
          </form>

          <div className="ml-auto flex items-center gap-2">
            {singleState === "approved" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                <CircleCheck className="size-3.5" />
                รับรองแล้ว
              </span>
            )}
            {single && singleState !== "approved" && (
              <ApproveReportButton
                documentHash={single.report.documentHash}
                employeeId={single.report.employee.id}
                employeeName={single.report.employee.name}
                month={month}
                monthInProgress={single.report.monthInProgress}
                monthLabel={formatThaiMonth(month)}
                reapprove={singleState === "stale"}
              />
            )}
            <PrintButton />
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 grid max-w-[297mm] gap-3 px-4 print:hidden">
        {errorMessage && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage}
          </p>
        )}
        {singleState === "stale" && single?.latest && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            ข้อมูลการลงเวลามีการเปลี่ยนแปลงหลังการรับรองครั้งล่าสุด ({single.latest.verification_id}) —
            ฉบับที่พิมพ์ตอนนี้จะแสดงเป็น “รอการรับรอง” จนกว่าจะรับรองฉบับแก้ไข
          </p>
        )}
        {printAll && sheets.length > 0 && (
          <p className="text-sm text-slate-500">
            รายงาน {sheets.length} คน · รับรองแล้ว{" "}
            {sheets.filter((s) => approvalStateFor(s.report, s.latest) === "approved").length} คน · เลือกพนักงานทีละคนเพื่อรับรอง
          </p>
        )}
        {!printAll && !selected && !errorMessage && (
          <p className="text-sm text-slate-500">ไม่พบพนักงานที่เลือก</p>
        )}
      </div>

      <div className={cn(sarabun.className, "mt-4 grid gap-8 print:mt-0 print:block")}>
        {sheets.map(({ report, latest, qrSvg }) => (
          <div key={report.employee.id} className="report-page overflow-x-auto px-4 print:overflow-visible print:px-0">
            <AttendanceReportSheet
              report={report}
              approval={approvalStateFor(report, latest) === "approved" ? latest! : null}
              qrSvg={qrSvg}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
