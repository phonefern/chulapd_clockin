import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  EmployeesTable,
  type Employee,
  type EmployeeLeave,
  type TodayAttendance,
} from "@/components/admin/employees-table";
import { getAdminSession } from "@/lib/requireAdminSession";
import { LEAVE_COLUMNS } from "@/lib/leaves";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { todayInBangkok } from "@/lib/workDate";

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
      .select("id, employee_code, name, display_name, department, line_user_id, role, active, reminders_enabled, created_at")
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
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">พนักงาน</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              แก้ไขชื่อทางการ รหัสพนักงาน สิทธิ์ สถานะการใช้งาน การแจ้งเตือน และวันลา
            </p>
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
