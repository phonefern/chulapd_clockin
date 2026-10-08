import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Clock3, Users, UserCheck } from "lucide-react";
import { AttendanceCharts, type AttendanceChartPoint } from "@/components/admin/attendance-charts";
import { RangePicker } from "@/components/admin/range-picker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminSession } from "@/lib/requireAdminSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { addWorkDays, enumerateWorkDates, isValidWorkDate, todayInBangkok } from "@/lib/workDate";

export const metadata: Metadata = {
  title: "สถิติ · ChulaPD Attendance",
};

type AttendanceRow = {
  work_date: string;
  employee_id: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  total_minutes: number | null;
};

type EmployeeRow = {
  id: string;
  name: string;
  display_name: string | null;
  employee_code: string | null;
  role: string;
  active: boolean;
};

type EmployeeSummary = {
  id: string;
  displayName: string;
  employeeCode: string | null;
  daysPresent: number;
  totalMinutes: number;
  missingClockOut: number;
};

function scalar(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveRange(params: { [key: string]: string | string[] | undefined }) {
  const today = todayInBangkok();
  let to = scalar(params.to);
  let from = scalar(params.from);

  if (!to || !isValidWorkDate(to)) to = today;
  if (!from || !isValidWorkDate(from)) from = addWorkDays(to, -6);
  if (from > to) from = to;

  const dates = enumerateWorkDates(from, to);
  if (dates.length > 90) {
    from = addWorkDays(to, -89);
  }

  return { from, to, today };
}

function formatHours(minutes: number) {
  return (minutes / 60).toFixed(2);
}

function formatDateLabel(date: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${date}T00:00:00+07:00`));
}

export default async function AdminStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const { from, to, today } = resolveRange(params);
  const dates = enumerateWorkDates(from, to);
  const supabase = getSupabaseAdmin();

  const [{ data: rowsData, error: rowsError }, { data: employeesData, error: employeesError }] =
    await Promise.all([
      supabase
        .from("attendance")
        .select("work_date, employee_id, clock_in_at, clock_out_at, total_minutes")
        .gte("work_date", from)
        .lte("work_date", to)
        .order("work_date", { ascending: true }),
      supabase
        .from("employees")
        .select("id, name, display_name, employee_code, role, active")
        .eq("active", true)
        .order("created_at", { ascending: true }),
    ]);

  const rows = (rowsData ?? []) as AttendanceRow[];
  const employees = (employeesData ?? []) as EmployeeRow[];

  const dayStats = new Map(
    dates.map((date) => [
      date,
      {
        presentEmployees: new Set<string>(),
        completedMinutes: 0,
        completedRows: 0,
      },
    ])
  );

  const employeeStats = new Map<string, EmployeeSummary>(
    employees.map((employee) => [
      employee.id,
      {
        id: employee.id,
        displayName: employee.display_name ?? employee.name,
        employeeCode: employee.employee_code,
        daysPresent: 0,
        totalMinutes: 0,
        missingClockOut: 0,
      },
    ])
  );

  for (const row of rows) {
    const day = dayStats.get(row.work_date);
    day?.presentEmployees.add(row.employee_id);

    const summary = employeeStats.get(row.employee_id);
    if (summary) {
      summary.daysPresent += row.clock_in_at ? 1 : 0;
      summary.totalMinutes += row.total_minutes ?? 0;
      if (row.clock_in_at && !row.clock_out_at) summary.missingClockOut += 1;
    }

    if (day && row.total_minutes !== null) {
      day.completedMinutes += row.total_minutes;
      day.completedRows += 1;
    }
  }

  const chartData: AttendanceChartPoint[] = dates.map((date) => {
    const day = dayStats.get(date)!;
    return {
      date,
      label: formatDateLabel(date),
      present: day.presentEmployees.size,
      avgHours: day.completedRows ? Number(formatHours(day.completedMinutes / day.completedRows)) : 0,
    };
  });

  const totalPresent = chartData.reduce((sum, day) => sum + day.present, 0);
  const completedDays = chartData.filter((day) => day.avgHours > 0);
  const avgHeadcount = dates.length ? totalPresent / dates.length : 0;
  const avgHours =
    completedDays.length
      ? completedDays.reduce((sum, day) => sum + day.avgHours, 0) / completedDays.length
      : 0;
  const summaries = [...employeeStats.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "th")
  );

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              สถิติการลงเวลา
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              วิเคราะห์แนวโน้มระหว่าง {from} ถึง {to}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <RangePicker from={from} to={to} today={today} />
          </div>
        </header>

        {(rowsError || employeesError) && (
          <p className="mb-4 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {rowsError?.message ?? employeesError?.message}
          </p>
        )}

        <section className="mb-7 grid gap-3 md:grid-cols-3" aria-label="สรุปสถิติ">
          <Card className="border-slate-200 bg-white py-0 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <Users className="size-5" />
              </span>
              <div>
                <p className="text-xs text-slate-500">พนักงานทั้งหมด</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{employees.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white py-0 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <UserCheck className="size-5" />
              </span>
              <div>
                <p className="text-xs text-slate-500">เฉลี่ยคนมาทำงาน/วัน</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{avgHeadcount.toFixed(1)}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white py-0 shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
                <Clock3 className="size-5" />
              </span>
              <div>
                <p className="text-xs text-slate-500">เฉลี่ยชั่วโมง/วัน</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{avgHours.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <AttendanceCharts data={chartData} />

        <section className="mt-7 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5 sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-slate-950">รายพนักงาน</h2>
              <p className="mt-1 text-xs text-slate-500">สรุปการลงเวลาตามช่วงวันที่เลือก</p>
            </div>
            <Badge variant="secondary">{summaries.length} คน</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5 sm:px-6">ชื่อ</TableHead>
                <TableHead>วันที่มา</TableHead>
                <TableHead>ชั่วโมงรวม</TableHead>
                <TableHead className="px-5 sm:px-6">ลืม Clock out</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((summary) => (
                <TableRow key={summary.id}>
                  <TableCell className="px-5 sm:px-6">
                    <strong className="block text-sm font-medium text-slate-800">{summary.displayName}</strong>
                    <small className="mt-1 block text-xs text-slate-400">
                      {summary.employeeCode ?? "ไม่มีรหัสพนักงาน"}
                    </small>
                  </TableCell>
                  <TableCell>{summary.daysPresent}</TableCell>
                  <TableCell className="font-mono">{formatHours(summary.totalMinutes)}</TableCell>
                  <TableCell className="px-5 sm:px-6">
                    <Badge variant={summary.missingClockOut ? "destructive" : "secondary"}>
                      {summary.missingClockOut}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </div>
    </main>
  );
}
