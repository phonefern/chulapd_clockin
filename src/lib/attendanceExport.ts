import type { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { enumerateWorkDates, lastDayOfMonth } from "@/lib/workDate";

export type MonthlyLedgerRow = {
  employeeId: string;
  employeeCode: string | null;
  employeeName: string;
  workDate: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  totalMinutes: number | null;
  status: string;
};

type EmployeeRow = {
  id: string;
  employee_code: string | null;
  name: string;
  display_name: string | null;
};

type AttendanceRow = {
  employee_id: string;
  work_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  total_minutes: number | null;
};

function computeLedgerStatus(attendance: AttendanceRow | undefined): string {
  if (!attendance?.clock_in_at) return "ไม่มาทำงาน";
  if (!attendance.clock_out_at) return "ยังไม่ Clock out";
  return "ปกติ";
}

export async function getMonthlyAttendanceLedger(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  month: string,
  employeeId?: string
): Promise<MonthlyLedgerRow[]> {
  const monthStart = `${month}-01`;
  const monthEnd = lastDayOfMonth(month);

  let employeesQuery = supabase
    .from("employees")
    .select("id, employee_code, name, display_name")
    .eq("active", true)
    .order("employee_code", { ascending: true });

  let attendanceQuery = supabase
    .from("attendance")
    .select("employee_id, work_date, clock_in_at, clock_out_at, total_minutes")
    .gte("work_date", monthStart)
    .lte("work_date", monthEnd);

  if (employeeId) {
    employeesQuery = employeesQuery.eq("id", employeeId);
    attendanceQuery = attendanceQuery.eq("employee_id", employeeId);
  }

  const [{ data: employeesData, error: employeesError }, { data: attendanceData, error: attendanceError }] =
    await Promise.all([
      employeesQuery,
      attendanceQuery,
    ]);

  if (employeesError) throw new Error(employeesError.message);
  if (attendanceError) throw new Error(attendanceError.message);

  const employees = (employeesData ?? []) as EmployeeRow[];
  const attendanceRows = (attendanceData ?? []) as AttendanceRow[];
  const attendanceByEmployeeDate = new Map(
    attendanceRows.map((row) => [`${row.employee_id}:${row.work_date}`, row])
  );

  return employees.flatMap((employee) =>
    enumerateWorkDates(monthStart, monthEnd).map((workDate) => {
      const attendance = attendanceByEmployeeDate.get(`${employee.id}:${workDate}`);
      return {
        employeeId: employee.id,
        employeeCode: employee.employee_code,
        employeeName: employee.display_name ?? employee.name,
        workDate,
        clockInAt: attendance?.clock_in_at ?? null,
        clockOutAt: attendance?.clock_out_at ?? null,
        totalMinutes: attendance?.total_minutes ?? null,
        status: computeLedgerStatus(attendance),
      };
    })
  );
}
