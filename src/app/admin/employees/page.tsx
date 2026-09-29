import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BarChart3, FileDown } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import {
  EmployeesTable,
  type Employee,
  type EmployeeLeave,
  type TodayAttendance,
} from "@/components/admin/employees-table";
import { buttonVariants } from "@/components/ui/button";
import { getAdminSession } from "@/lib/requireAdminSession";
import { LEAVE_COLUMNS } from "@/lib/leaves";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { todayInBangkok } from "@/lib/workDate";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "พนักงาน · ChulaPD Attendance",
};

export default async function AdminEmployeesPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const supabase = getSupabaseAdmin();
  const today = todayInBangkok();
  const [{ data, error }, { data: todayRows }, { data: leaveRows }] = await Promise.all([
    supabase
      .from("employees")
      .select("id, employee_code, name, display_name, line_user_id, role, active, reminders_enabled, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("attendance")
      .select("employee_id, clock_in_at, clock_out_at")
      .eq("work_date", today),
    supabase
      .from("employee_leaves")
      .select(LEAVE_COLUMNS)
      .gte("end_date", today)
      .order("start_date", { ascending: true }),
  ]);

  const employees = (data ?? []) as Employee[];
  const todayStatusByEmployee = Object.fromEntries(
    ((todayRows ?? []) as TodayAttendance[]).map((row) => [row.employee_id, row])
  );
  const leavesByEmployee: Record<string, EmployeeLeave[]> = {};
  for (const leave of (leaveRows ?? []) as EmployeeLeave[]) {
    (leavesByEmployee[leave.employee_id] ??= []).push(leave);
  }
  const employeesVersion = employees
    .map((employee) => `${employee.id}:${employee.name}:${employee.display_name ?? ""}:${employee.employee_code ?? ""}:${employee.role}:${employee.active}:${employee.reminders_enabled}`)
    .join("|");

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div>
            <BrandMark className="mb-3" />
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">พนักงาน</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              แก้ไขชื่อทางการ รหัสพนักงาน สิทธิ์ สถานะการใช้งาน การแจ้งเตือน และวันลา
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
              <ArrowLeft className="size-4" />
              Attendance วันนี้
            </Link>
            <Link href="/admin/stats" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
              <BarChart3 className="size-4" />
              สถิติ
            </Link>
            <Link href="/admin/export" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
              <FileDown className="size-4" />
              ส่งออก
            </Link>
          </div>
        </header>

        {error && <p className="mb-4 text-sm text-destructive">{error.message}</p>}

        <EmployeesTable
          key={employeesVersion}
          initialEmployees={employees}
          todayStatusByEmployee={todayStatusByEmployee}
          initialLeavesByEmployee={leavesByEmployee}
          today={today}
        />
      </div>
    </main>
  );
}
