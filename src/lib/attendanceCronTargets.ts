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
  skippedOnLeave: number;
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
  reminders_enabled: boolean;
};

// Which half of the day a reminder belongs to. A "morning" leave only suppresses start-of-day
// reminders, an "afternoon" leave only end-of-day ones, a "full" leave suppresses both.
type ReminderSlot = "start" | "end";

async function getEmployeeIdsOnLeave(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  workDate: string,
  slot: ReminderSlot
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("employee_leaves")
    .select("employee_id")
    .lte("start_date", workDate)
    .gte("end_date", workDate)
    .in("period", slot === "start" ? ["full", "morning"] : ["full", "afternoon"]);

  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((row) => row.employee_id as string));
}

export async function getNotYetClockedInToday(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<CronTargetsResult> {
  const workDate = todayInBangkok();

  const { data: employees, error: employeesError } = await supabase
    .from("employees")
    .select("id, line_user_id, name, display_name")
    .eq("active", true)
    .eq("reminders_enabled", true)
    .not("line_user_id", "is", null);

  if (employeesError) throw new Error(employeesError.message);

  const { data: clockedIn, error: attendanceError } = await supabase
    .from("attendance")
    .select("employee_id")
    .eq("work_date", workDate)
    .not("clock_in_at", "is", null);

  if (attendanceError) throw new Error(attendanceError.message);

  const onLeaveIds = await getEmployeeIdsOnLeave(supabase, workDate, "start");
  const clockedInIds = new Set((clockedIn ?? []).map((row) => row.employee_id));
  const employeeRows = (employees ?? []) as ActiveEmployeeRow[];
  const notClockedIn = employeeRows.filter(
    (employee) => employee.line_user_id && !clockedInIds.has(employee.id)
  );
  const targets = notClockedIn
    .filter((employee) => !onLeaveIds.has(employee.id))
    .map((employee) => ({
      id: employee.id,
      lineUserId: employee.line_user_id!,
      name: employee.name,
      displayName: employee.display_name,
    }));

  return {
    checked: employeeRows.length,
    skippedOnLeave: notClockedIn.length - targets.length,
    targets,
  };
}

export async function getClockedInNotOutToday(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<CronTargetsResult> {
  const workDate = todayInBangkok();

  const { data: rows, error } = await supabase
    .from("attendance")
    .select("employee_id, employees(line_user_id, name, display_name, active, reminders_enabled)")
    .eq("work_date", workDate)
    .not("clock_in_at", "is", null)
    .is("clock_out_at", null);

  if (error) throw new Error(error.message);

  const onLeaveIds = await getEmployeeIdsOnLeave(supabase, workDate, "end");
  const targetRows = rows ?? [];
  let skippedOnLeave = 0;
  const targets = targetRows.flatMap((row) => {
    const employee = row.employees as unknown as EmployeeInfo | null;
    if (!employee?.active || !employee.reminders_enabled || !employee.line_user_id) return [];
    if (onLeaveIds.has(row.employee_id)) {
      skippedOnLeave++;
      return [];
    }
    return [
      {
        id: row.employee_id,
        lineUserId: employee.line_user_id,
        name: employee.name,
        displayName: employee.display_name,
      },
    ];
  });

  return { checked: targetRows.length, skippedOnLeave, targets };
}
