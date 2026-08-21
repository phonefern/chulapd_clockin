import type { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { lastDayOfMonth, todayInBangkok } from "@/lib/workDate";
import {
  getBangkokTimeParts,
  WORK_START_HOUR,
  WORK_START_MINUTE,
} from "@/lib/workSchedule";

export type AttendanceStatsRow = {
  work_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  total_minutes: number | null;
  status: string | null;
};

export type EmployeeMonthSummary = {
  daysPresent: number;
  totalMinutes: number;
  missingClockOutDays: number;
  onTimeDays: number;
  rows: AttendanceStatsRow[];
};

export type EmployeeTodayStatus = AttendanceStatsRow | null;

function isOnTime(clockInAt: string | null): boolean {
  if (!clockInAt) return false;
  const { hour, minute } = getBangkokTimeParts(new Date(clockInAt));
  return hour * 60 + minute <= WORK_START_HOUR * 60 + WORK_START_MINUTE;
}

export async function getEmployeeMonthSummary(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  employeeId: string,
  month: string
): Promise<EmployeeMonthSummary> {
  const { data, error } = await supabase
    .from("attendance")
    .select("work_date, clock_in_at, clock_out_at, total_minutes, status")
    .eq("employee_id", employeeId)
    .gte("work_date", `${month}-01`)
    .lte("work_date", lastDayOfMonth(month))
    .order("work_date", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as AttendanceStatsRow[];
  return rows.reduce<EmployeeMonthSummary>(
    (summary, row) => {
      if (row.clock_in_at) {
        summary.daysPresent += 1;
        if (isOnTime(row.clock_in_at)) summary.onTimeDays += 1;
      }
      summary.totalMinutes += row.total_minutes ?? 0;
      if (row.clock_in_at && !row.clock_out_at) summary.missingClockOutDays += 1;
      summary.rows.push(row);
      return summary;
    },
    {
      daysPresent: 0,
      totalMinutes: 0,
      missingClockOutDays: 0,
      onTimeDays: 0,
      rows: [],
    }
  );
}

export async function getEmployeeTodayStatus(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  employeeId: string
): Promise<EmployeeTodayStatus> {
  const { data, error } = await supabase
    .from("attendance")
    .select("work_date, clock_in_at, clock_out_at, total_minutes, status")
    .eq("employee_id", employeeId)
    .eq("work_date", todayInBangkok())
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as EmployeeTodayStatus;
}
