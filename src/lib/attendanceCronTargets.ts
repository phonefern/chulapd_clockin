import type { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { todayInBangkok } from "@/lib/workDate";

export type EmployeeTarget = {
  id: string;
  lineUserId: string;
  name: string;
  displayName: string | null;
};

export type CronTargetsResult = {
  checked: number;
  targets: EmployeeTarget[];
};

type ActiveEmployeeRow = {
  id: string;
  line_user_id: string | null;
  name: string;
  display_name: string | null;
};

type EmployeeInfo = {
  line_user_id: string | null;
  name: string;
  display_name: string | null;
  active: boolean;
};

export async function getNotYetClockedInToday(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<CronTargetsResult> {
  const workDate = todayInBangkok();

  const { data: employees, error: employeesError } = await supabase
    .from("employees")
    .select("id, line_user_id, name, display_name")
    .eq("active", true)
    .not("line_user_id", "is", null);

  if (employeesError) throw new Error(employeesError.message);

  const { data: clockedIn, error: attendanceError } = await supabase
    .from("attendance")
    .select("employee_id")
    .eq("work_date", workDate)
    .not("clock_in_at", "is", null);

  if (attendanceError) throw new Error(attendanceError.message);

  const clockedInIds = new Set((clockedIn ?? []).map((row) => row.employee_id));
  const employeeRows = (employees ?? []) as ActiveEmployeeRow[];
  const targets = employeeRows
    .filter((employee) => employee.line_user_id && !clockedInIds.has(employee.id))
    .map((employee) => ({
      id: employee.id,
      lineUserId: employee.line_user_id!,
      name: employee.name,
      displayName: employee.display_name,
    }));

  return { checked: employeeRows.length, targets };
}

export async function getClockedInNotOutToday(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<CronTargetsResult> {
  const { data: rows, error } = await supabase
    .from("attendance")
    .select("employee_id, employees(line_user_id, name, display_name, active)")
    .eq("work_date", todayInBangkok())
    .not("clock_in_at", "is", null)
    .is("clock_out_at", null);

  if (error) throw new Error(error.message);

  const targetRows = rows ?? [];
  const targets = targetRows.flatMap((row) => {
    const employee = row.employees as unknown as EmployeeInfo | null;
    if (!employee?.active || !employee.line_user_id) return [];
    return [
      {
        id: row.employee_id,
        lineUserId: employee.line_user_id,
        name: employee.name,
        displayName: employee.display_name,
      },
    ];
  });

  return { checked: targetRows.length, targets };
}
