import type { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { addWorkDays, lastDayOfMonth, todayInBangkok } from "@/lib/workDate";

// Self-reported clock-outs from outside the geofence (e.g. forgot to press before leaving).
export const REMOTE_CLOCK_OUT_MONTHLY_LIMIT = 3;
// How far back an open (clocked-in, never clocked-out) day can still be closed by the employee.
export const REMOTE_CLOCK_OUT_LOOKBACK_DAYS = 7;

export type OpenAttendanceRow = {
  id: string;
  work_date: string;
  clock_in_at: string;
};

export type RemoteClockOutQuota = {
  month: string;
  limit: number;
  used: number;
  remaining: number;
};

// Quota is counted per work_date month, so closing a day always charges that day's month.
export async function getRemoteClockOutQuota(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  employeeId: string,
  month: string
): Promise<RemoteClockOutQuota> {
  const { count, error } = await supabase
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", employeeId)
    .eq("clock_out_method", "remote")
    .gte("work_date", `${month}-01`)
    .lte("work_date", lastDayOfMonth(month));

  if (error) throw new Error(error.message);

  const used = count ?? 0;
  return {
    month,
    limit: REMOTE_CLOCK_OUT_MONTHLY_LIMIT,
    used,
    remaining: Math.max(0, REMOTE_CLOCK_OUT_MONTHLY_LIMIT - used),
  };
}

export function earliestRemoteClockOutDate(): string {
  return addWorkDays(todayInBangkok(), -(REMOTE_CLOCK_OUT_LOOKBACK_DAYS - 1));
}

export async function getOpenAttendanceRows(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  employeeId: string
): Promise<OpenAttendanceRow[]> {
  const { data, error } = await supabase
    .from("attendance")
    .select("id, work_date, clock_in_at")
    .eq("employee_id", employeeId)
    .gte("work_date", earliestRemoteClockOutDate())
    .not("clock_in_at", "is", null)
    .is("clock_out_at", null)
    .order("work_date", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as OpenAttendanceRow[];
}
