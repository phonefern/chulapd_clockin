import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, Clock3, FileClock, FileDown, Users, UserCheck } from "lucide-react";
import { AutoRefresh } from "@/components/admin/auto-refresh";
import { DateNav } from "@/components/admin/date-nav";
import { EditAttendanceButton } from "@/components/admin/edit-attendance-button";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { resolveWorkDate, todayInBangkok } from "@/lib/workDate";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Attendance วันนี้ · ChulaPD Attendance",
};

type AttendanceRow = {
  id: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  clock_out_method: "geofence" | "remote" | null;
  clock_out_note: string | null;
  total_minutes: number | null;
  status: string;
  employees: { name: string; display_name: string | null; employee_code: string | null } | null;
};

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

function formatDate(date: string) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${date}T00:00:00+07:00`));
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const today = todayInBangkok();
  const workDate = resolveWorkDate(params.date);
  const isToday = workDate === today;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("attendance")
    .select(
      "id, clock_in_at, clock_out_at, clock_out_method, clock_out_note, total_minutes, status, employees(name, display_name, employee_code)"
    )
    .eq("work_date", workDate)
    .order("clock_in_at", { ascending: true });

  const rows = (data ?? []) as unknown as AttendanceRow[];
  const presentCount = rows.filter((row) => row.clock_in_at).length;
  const completedCount = rows.filter((row) => row.clock_in_at && row.clock_out_at).length;
  const activeCount = rows.filter((row) => row.clock_in_at && !row.clock_out_at).length;
  const totalMinutes = rows.reduce((total, row) => total + (row.total_minutes ?? 0), 0);
  const updatedAt = new Date().toISOString();

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <BrandMark />
              <p className="text-xs font-semibold tracking-[0.16em] text-emerald-700">
                WORKFORCE OVERVIEW
              </p>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              Attendance วันนี้
            </h1>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <DateNav date={workDate} today={today} />
              <span className="text-sm text-slate-500">{formatDate(workDate)}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AutoRefresh key={updatedAt} isToday={isToday} updatedAt={updatedAt} />
            <Link href="/admin/stats" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
              <BarChart3 className="size-4" />
              สถิติ
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/admin/export" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
              <FileDown className="size-4" />
              ส่งออก
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/admin/employees" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
              <Users className="size-4" />
              จัดการพนักงาน
              <ArrowRight className="size-4" />
            </Link>
            <div className="hidden items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm sm:flex">
              <span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-sm font-semibold text-emerald-700">
                {session.email.charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="text-[11px] text-slate-500">ผู้ดูแลระบบ</p>
                <p className="max-w-44 truncate text-xs font-medium text-slate-700">{session.email}</p>
              </div>
            </div>
          </div>
        </header>

        <section className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="สรุปการลงเวลา">
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <Users className="size-5" />
              </span>
              <div>
                <p className="text-xs text-slate-500">พนักงานลงเวลา</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{presentCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                <UserCheck className="size-5" />
              </span>
              <div>
                <p className="text-xs text-slate-500">ลงเวลาครบแล้ว</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{completedCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600">
                <Clock3 className="size-5" />
              </span>
              <div>
                <p className="text-xs text-slate-500">กำลังทำงาน</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{activeCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
                <FileClock className="size-5" />
              </span>
              <div>
                <p className="text-xs text-slate-500">ชั่วโมงรวม</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{formatHours(totalMinutes)}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
            <div>
              <CardTitle className="text-base font-semibold text-slate-950">รายชื่อการลงเวลา</CardTitle>
              <p className="mt-1 text-xs text-slate-500">รายละเอียดของพนักงานที่ลงเวลาในวันที่เลือก</p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {rows.length} รายการ
            </Badge>
          </CardHeader>

          {error && <p className="m-5 text-sm text-destructive">{error.message}</p>}
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-5 text-xs text-slate-500 sm:px-6">ชื่อพนักงาน</TableHead>
                <TableHead className="text-xs text-slate-500">เวลาเข้า</TableHead>
                <TableHead className="text-xs text-slate-500">เวลาออก</TableHead>
                <TableHead className="text-xs text-slate-500">ชั่วโมง</TableHead>
                <TableHead className="px-5 text-xs text-slate-500 sm:px-6">สถานะ</TableHead>
                <TableHead className="w-10 text-xs text-slate-500" aria-label="แก้ไขเวลา" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const displayName = row.employees?.display_name ?? row.employees?.name ?? "-";
                const isPresent = !!row.clock_in_at;
                const isCompleted = !!row.clock_in_at && !!row.clock_out_at;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="px-5 sm:px-6">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600">
                          {displayName.charAt(0)}
                        </span>
                        <div>
                          <strong className="block text-sm font-medium text-slate-800">{displayName}</strong>
                          <small className="mt-1 block text-xs text-slate-400">
                            {row.employees?.employee_code ?? "ไม่มีรหัสพนักงาน"}
                          </small>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">{formatTime(row.clock_in_at)}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">
                      {formatTime(row.clock_out_at)}
                      {row.clock_out_method === "remote" && (
                        <span
                          className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 font-sans text-[10px] font-medium text-amber-800"
                          title={row.clock_out_note ?? "พนักงานลงเวลาออกเองนอกพื้นที่"}
                        >
                          นอกพื้นที่
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium text-slate-700">
                      {formatHours(row.total_minutes)}
                    </TableCell>
                    <TableCell className="px-5 sm:px-6">
                      <Badge
                        variant={isCompleted ? "secondary" : "outline"}
                        className={
                          isCompleted
                            ? "bg-emerald-50 text-emerald-700"
                            : isPresent
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-slate-200 bg-slate-50 text-slate-500"
                        }
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            isCompleted ? "bg-emerald-500" : isPresent ? "bg-amber-500" : "bg-slate-400"
                          )}
                        />
                        {isCompleted ? "ปกติ" : isPresent ? "กำลังทำงาน" : "ล้างเวลาแล้ว"}
                      </Badge>
                    </TableCell>
                    <TableCell className="pr-4">
                      <EditAttendanceButton
                        attendanceId={row.id}
                        clockInAt={row.clock_in_at}
                        clockOutAt={row.clock_out_at}
                        employeeName={displayName}
                        workDateLabel={formatDate(workDate)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-sm text-slate-500">
                    ยังไม่มีใครลงเวลาในวันที่เลือก
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
      </div>
    </main>
  );
}
