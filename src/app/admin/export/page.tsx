import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { PrintButton } from "@/components/admin/print-button";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMonthlyAttendanceLedger, type MonthlyLedgerRow } from "@/lib/attendanceExport";
import { getAdminSession } from "@/lib/requireAdminSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveWorkMonth } from "@/lib/workDate";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "ส่งออกรายงาน · ChulaPD Attendance",
};

type EmployeeOption = {
  id: string;
  employee_code: string | null;
  name: string;
  display_name: string | null;
};

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatTime(iso: string | null) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

function formatHours(totalMinutes: number | null) {
  if (totalMinutes === null) return "-";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatThaiDate(date: string) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${date}T00:00:00+07:00`));
}

function formatThaiMonth(month: string) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${month}-01T00:00:00+07:00`));
}

export default async function AdminExportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const month = resolveWorkMonth(params.month);
  const supabase = getSupabaseAdmin();
  const { data: employeesData, error: employeesError } = await supabase
    .from("employees")
    .select("id, employee_code, name, display_name")
    .eq("active", true)
    .order("employee_code", { ascending: true });

  const employees = (employeesData ?? []) as EmployeeOption[];
  const employeeParam = scalar(params.employee);
  const selectedEmployeeId =
    employeeParam && employeeParam !== "all" && employees.some((employee) => employee.id === employeeParam)
      ? employeeParam
      : undefined;
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) ?? null;
  let ledger: MonthlyLedgerRow[] = [];
  let errorMessage: string | null = employeesError?.message ?? null;

  if (!employeesError) {
    try {
      ledger = await getMonthlyAttendanceLedger(supabase, month, selectedEmployeeId);
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ";
    }
  }

  const employeeCount = new Set(ledger.map((row) => row.employeeId)).size;
  const daysPresent = ledger.filter((row) => row.clockInAt).length;
  const downloadParams = new URLSearchParams({ month, employee: selectedEmployeeId ?? "all" });
  const downloadHref = `/api/admin/export/attendance-csv?${downloadParams.toString()}`;

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="no-print mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <BrandMark className="mb-3" />
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              ส่งออกรายงานรับรองการทำงาน
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              ตารางรายเดือนสำหรับดาวน์โหลด CSV หรือพิมพ์ให้หัวหน้าลงนาม
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
              <ArrowLeft className="size-4" />
              Attendance วันนี้
            </Link>
            <a className={cn(buttonVariants({ variant: "outline" }), "gap-2")} href={downloadHref}>
              <Download className="size-4" />
              ดาวน์โหลด CSV
            </a>
            <PrintButton />
          </div>
        </header>

        <section className="no-print mb-7 grid gap-3 md:grid-cols-[minmax(360px,480px)_1fr_1fr]">
          <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-slate-500" htmlFor="month">
                เดือน
              </label>
              <Input className="mt-2" id="month" name="month" type="month" defaultValue={month} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500" htmlFor="employee">
                พนักงาน
              </label>
              <select
                className="mt-2 h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                defaultValue={selectedEmployeeId ?? "all"}
                id="employee"
                name="employee"
              >
                <option value="all">ทั้งหมด</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.employee_code ? `${employee.employee_code} · ` : ""}
                    {employee.display_name ?? employee.name}
                  </option>
                ))}
              </select>
            </div>
            <button className={cn(buttonVariants({ size: "sm" }), "sm:col-span-2")} type="submit">
              เปลี่ยนตัวกรอง
            </button>
          </form>
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs text-slate-500">ขอบเขตรายงาน</p>
              <p className="mt-1 truncate text-lg font-semibold text-slate-950">
                {selectedEmployee ? selectedEmployee.display_name ?? selectedEmployee.name : "ทั้งหมด"}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {selectedEmployee ? selectedEmployee.employee_code ?? "ไม่มีรหัสพนักงาน" : `${employeeCount} คน`}
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="p-5">
              <p className="text-xs text-slate-500">รายการมาทำงาน</p>
              <p className="mt-1 text-2xl font-semibold text-slate-950">{daysPresent}</p>
            </CardContent>
          </Card>
        </section>

        <section className="print-ledger overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                รายงานการลงเวลาประจำเดือน {formatThaiMonth(month)}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {selectedEmployee ? `เฉพาะ ${selectedEmployee.display_name ?? selectedEmployee.name}` : "พนักงานทั้งหมด"} · มาแล้ว {daysPresent} รายการ
              </p>
            </div>
            <Badge className="w-fit" variant="secondary">
              {ledger.length} รายการ
            </Badge>
          </div>

          {errorMessage && (
            <p className="m-5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {errorMessage}
            </p>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5 sm:px-6">ชื่อพนักงาน</TableHead>
                <TableHead>วันที่</TableHead>
                <TableHead>เวลาเข้า</TableHead>
                <TableHead>เวลาออก</TableHead>
                <TableHead>ชั่วโมง</TableHead>
                <TableHead className="px-5 sm:px-6">สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((row) => (
                <TableRow key={`${row.employeeId}-${row.workDate}`} className="print-row">
                  <TableCell className="px-5 sm:px-6">
                    <strong className="block text-sm font-medium text-slate-800">{row.employeeName}</strong>
                    <small className="mt-1 block text-xs text-slate-400">
                      {row.employeeCode ?? "ไม่มีรหัสพนักงาน"}
                    </small>
                  </TableCell>
                  <TableCell>{formatThaiDate(row.workDate)}</TableCell>
                  <TableCell className="font-mono">{formatTime(row.clockInAt)}</TableCell>
                  <TableCell className="font-mono">{formatTime(row.clockOutAt)}</TableCell>
                  <TableCell className="font-mono">{formatHours(row.totalMinutes)}</TableCell>
                  <TableCell className="px-5 sm:px-6">{row.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="print-signature hidden px-8 py-12 text-sm text-slate-950">
            <p>ลงชื่อ .................................................... ผู้รับรอง</p>
            <p className="mt-6">วันที่ ....................................................</p>
          </div>
        </section>
      </div>
    </main>
  );
}
