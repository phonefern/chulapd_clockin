import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock3,
  Download,
  FileText,
  Printer,
  Users,
} from "lucide-react";
import {
  CreateApprovalLinkButton,
  RevokeLinkButton,
  SendReportsButton,
} from "@/components/report/admin-report-actions";
import { formatThaiDateTime } from "@/components/report/attendance-report-sheet";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  approvalStateFor,
  buildMonthlyReports,
  getLatestApprovals,
  type ApprovalState,
  type MonthlyReport,
  type ReportApproval,
} from "@/lib/attendanceReport";
import { listActiveApprovalLinks, type ApprovalLink } from "@/lib/approvalLinks";
import { getAdminSession } from "@/lib/requireAdminSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cn } from "@/lib/utils";
import { addWorkMonths, currentMonthInBangkok, resolveWorkMonth } from "@/lib/workDate";

export const metadata: Metadata = {
  title: "รายงานรับรอง · ChulaPD Attendance",
};

type Row = {
  report: MonthlyReport;
  latest: ReportApproval | undefined;
  state: ApprovalState;
};

const STATE_BADGE: Record<ApprovalState, { label: string; className: string }> = {
  approved: { label: "รับรองแล้ว", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  pending: { label: "รอรับรอง", className: "bg-slate-100 text-slate-600 ring-slate-200" },
  stale: { label: "ข้อมูลเปลี่ยนหลังรับรอง", className: "bg-amber-50 text-amber-800 ring-amber-200" },
};

function formatThaiMonth(month: string) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${month}-01T00:00:00+07:00`));
}

function formatTotal(minutes: number) {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

function reportHref(month: string, employee: string) {
  return `/admin/export/report?${new URLSearchParams({ month, employee }).toString()}`;
}

function csvHref(month: string, employee: string) {
  return `/api/admin/export/attendance-csv?${new URLSearchParams({ month, employee }).toString()}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <Card className="border-slate-200 bg-white py-0 shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <span className={cn("grid size-10 place-items-center rounded-xl", tone)}>
          <Icon className="size-5" />
        </span>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminExportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const params = await searchParams;
  const month = resolveWorkMonth(params.month);
  const supabase = getSupabaseAdmin();

  let rows: Row[] = [];
  let activeLinks: ApprovalLink[] = [];
  let errorMessage: string | null = null;
  try {
    const [reports, latestByEmployee, links] = await Promise.all([
      buildMonthlyReports(supabase, month),
      getLatestApprovals(supabase, month),
      listActiveApprovalLinks(supabase, month),
    ]);
    activeLinks = links;
    rows = reports.map((report) => {
      const latest = latestByEmployee.get(report.employee.id);
      return { report, latest, state: approvalStateFor(report, latest) };
    });
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ";
  }

  const approvedCount = rows.filter((r) => r.state === "approved").length;
  const staleCount = rows.filter((r) => r.state === "stale").length;
  const pendingCount = rows.filter((r) => r.state === "pending").length;
  const isFutureMonth = month > currentMonthInBangkok();
  const monthLabel = formatThaiMonth(month);
  const nameById = new Map(rows.map((r) => [r.report.employee.id, r.report.employee.name]));
  const approvedUnsent = rows
    .filter((r) => r.state === "approved" && !r.latest?.sent_to_employee_at)
    .map((r) => ({ id: r.report.employee.id, name: r.report.employee.name }));

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-[#1b2f55]">MONTHLY CERTIFICATION</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              รายงานรับรองเวลาปฏิบัติงาน
            </h1>
            <div className="mt-4 flex items-center gap-2">
              <Link
                aria-label="เดือนก่อนหน้า"
                href={`/admin/export?month=${addWorkMonths(month, -1)}`}
                className={buttonVariants({ variant: "outline", size: "icon-sm" })}
              >
                <ChevronLeft className="size-4" />
              </Link>
              <span className="min-w-32 text-center text-base font-semibold">{formatThaiMonth(month)}</span>
              <Link
                aria-label="เดือนถัดไป"
                href={`/admin/export?month=${addWorkMonths(month, 1)}`}
                className={buttonVariants({ variant: "outline", size: "icon-sm" })}
              >
                <ChevronRight className="size-4" />
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <CreateApprovalLinkButton
              employees={rows.map((r) => ({
                id: r.report.employee.id,
                name: r.report.employee.name,
                code: r.report.employee.code,
                state: r.state,
              }))}
              month={month}
              monthLabel={monthLabel}
            />
            <SendReportsButton
              employees={approvedUnsent}
              label={`ส่งทาง LINE (${approvedUnsent.length})`}
              month={month}
              monthLabel={monthLabel}
              size="default"
            />
            <a className={cn(buttonVariants({ variant: "outline" }), "gap-2")} href={csvHref(month, "all")}>
              <Download className="size-4" />
              CSV ทุกคน
            </a>
            <Link
              className={cn(buttonVariants(), "gap-2 bg-[#1b2f55] text-white hover:bg-[#1b2f55]/90")}
              href={reportHref(month, "all")}
            >
              <Printer className="size-4" />
              พิมพ์รายงานทุกคน
            </Link>
          </div>
        </header>

        <section className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="สรุปสถานะการรับรอง">
          <StatCard icon={Users} label="พนักงาน" value={rows.length} tone="bg-blue-50 text-blue-600" />
          <StatCard icon={CircleCheck} label="รับรองแล้ว" value={approvedCount} tone="bg-emerald-50 text-emerald-600" />
          <StatCard icon={Clock3} label="รอรับรอง" value={pendingCount} tone="bg-slate-100 text-slate-600" />
          <StatCard
            icon={AlertTriangle}
            label="ต้องรับรองใหม่"
            value={staleCount}
            tone="bg-amber-50 text-amber-600"
          />
        </section>

        {errorMessage && (
          <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {errorMessage}
          </p>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-slate-950">รายงานรายบุคคล</h2>
              <p className="mt-1 text-xs text-slate-500">
                เปิดรายงานเพื่อตรวจสอบ พิมพ์ (A4 แนวนอน 1 หน้า) และรับรองแบบดิจิทัล
              </p>
            </div>
            {isFutureMonth && (
              <span className="text-xs text-amber-700">เดือนที่เลือกยังมาไม่ถึง</span>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5 sm:px-6">พนักงาน</TableHead>
                <TableHead className="text-right">มีบันทึก</TableHead>
                <TableHead className="text-right">ชั่วโมงรวม</TableHead>
                <TableHead className="text-right">ไม่มีข้อมูล</TableHead>
                <TableHead className="text-right">ลา</TableHead>
                <TableHead className="text-right">แก้ไข</TableHead>
                <TableHead>การรับรอง</TableHead>
                <TableHead className="px-5 text-right sm:px-6">รายงาน</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ report, latest, state }) => {
                const { summary } = report;
                const badge = STATE_BADGE[state];
                return (
                  <TableRow key={report.employee.id}>
                    <TableCell className="px-5 sm:px-6">
                      <strong className="block text-sm font-medium text-slate-800">{report.employee.name}</strong>
                      <small className="mt-0.5 block text-xs text-slate-400">
                        {report.employee.code ?? "ไม่มีรหัสพนักงาน"}
                      </small>
                      {(summary.invalidDays > 0 || summary.incompleteDays > 0) && (
                        <small className="mt-1 flex items-center gap-1 text-[11px] text-rose-700">
                          <AlertTriangle className="size-3" />
                          {[
                            summary.invalidDays > 0 && `เวลาไม่ถูกต้อง ${summary.invalidDays} วัน`,
                            summary.incompleteDays > 0 && `ไม่มีเวลาออก ${summary.incompleteDays} วัน`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}{" "}
                          — ตรวจสอบก่อนรับรอง
                        </small>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{summary.recordedDays} วัน</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatTotal(summary.totalMinutes)}</TableCell>
                    <TableCell
                      className={cn("text-right tabular-nums", summary.noRecordDays > 0 && "text-rose-700")}
                    >
                      {summary.noRecordDays}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{summary.leaveDays}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", summary.editedCount > 0 && "text-sky-700")}>
                      {summary.editedCount}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1",
                          badge.className
                        )}
                      >
                        {badge.label}
                      </span>
                      {latest && (
                        <small className="mt-1 block text-[11px] text-slate-400">
                          {latest.approver_name}
                          {latest.approved_via === "link" && " (ผ่านลิงก์)"} · {formatThaiDateTime(latest.approved_at)}
                        </small>
                      )}
                      {state === "approved" && latest?.sent_to_employee_at && (
                        <small className="block text-[11px] text-emerald-700">
                          ส่ง LINE แล้ว {formatThaiDateTime(latest.sent_to_employee_at)}
                        </small>
                      )}
                    </TableCell>
                    <TableCell className="px-5 sm:px-6">
                      <div className="flex justify-end gap-2">
                        {state === "approved" && latest && (
                          <>
                            <a
                              className={buttonVariants({ variant: "ghost", size: "sm" })}
                              href={`/api/reports/pdf/${latest.id}`}
                              rel="noreferrer"
                              target="_blank"
                            >
                              PDF
                            </a>
                            <SendReportsButton
                              employees={[{ id: report.employee.id, name: report.employee.name }]}
                              label={latest.sent_to_employee_at ? "ส่งอีกครั้ง" : "ส่ง LINE"}
                              month={month}
                              monthLabel={monthLabel}
                              variant="ghost"
                            />
                          </>
                        )}
                        <a
                          aria-label={`ดาวน์โหลด CSV ของ ${report.employee.name}`}
                          className={buttonVariants({ variant: "ghost", size: "sm" })}
                          href={csvHref(month, report.employee.id)}
                        >
                          CSV
                        </a>
                        <Link
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                          href={reportHref(month, report.employee.id)}
                        >
                          <FileText className="size-4" />
                          {state === "approved" ? "เปิดรายงาน" : "ตรวจสอบและรับรอง"}
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && !errorMessage && (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-sm text-slate-500">
                    ไม่มีพนักงานที่ใช้งานอยู่
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>

        {activeLinks.length > 0 && (
          <section className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <h2 className="text-base font-semibold text-slate-950">ลิงก์รับรองที่ยังใช้งานได้</h2>
              <p className="mt-1 text-xs text-slate-500">
                ลิงก์ที่ส่งให้หัวหน้าเดือนนี้ · หากส่งผิดคน กดยกเลิกได้ทันที
              </p>
            </div>
            <ul className="divide-y divide-slate-100">
              {activeLinks.map((link) => (
                <li key={link.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm sm:px-6">
                  <span className="font-medium text-slate-800">
                    {link.approver_name} · {link.approver_role}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-500">
                    {link.employee_ids.map((id) => nameById.get(id) ?? "พนักงานที่ปิดใช้งาน").join(", ")}
                  </span>
                  <span className="text-xs text-slate-400">หมดอายุ {formatThaiDateTime(link.expires_at)}</span>
                  <RevokeLinkButton id={link.id} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
