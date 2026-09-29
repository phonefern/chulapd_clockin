import { addWorkDays, isValidWorkDate } from "@/lib/workDate";

export const LEAVE_PERIODS = ["full", "morning", "afternoon"] as const;
export type LeavePeriod = (typeof LEAVE_PERIODS)[number];

export const LEAVE_COLUMNS = "id, employee_id, start_date, end_date, period, note, created_by, created_at";

// Guards against typos like picking next year instead of next month.
export const MAX_LEAVE_DAYS = 60;

export type LeaveInput = {
  start_date: string;
  end_date: string;
  period: LeavePeriod;
  note: string | null;
};

// Validates a leave request body. Returns the normalized row fields, or a Thai/English error message.
export function parseLeaveInput(body: Record<string, unknown>): LeaveInput | { error: string } {
  const { start_date, end_date, period = "full", note } = body;

  if (typeof start_date !== "string" || !isValidWorkDate(start_date)) {
    return { error: "start_date must be YYYY-MM-DD" };
  }
  const endDate = end_date === undefined || end_date === "" ? start_date : end_date;
  if (typeof endDate !== "string" || !isValidWorkDate(endDate)) {
    return { error: "end_date must be YYYY-MM-DD" };
  }
  if (endDate < start_date) {
    return { error: "วันสิ้นสุดต้องไม่ก่อนวันเริ่มลา" };
  }
  if (endDate > addWorkDays(start_date, MAX_LEAVE_DAYS - 1)) {
    return { error: `ลาได้ครั้งละไม่เกิน ${MAX_LEAVE_DAYS} วัน` };
  }
  if (typeof period !== "string" || !(LEAVE_PERIODS as readonly string[]).includes(period)) {
    return { error: "period must be full, morning or afternoon" };
  }

  return {
    start_date,
    end_date: endDate,
    period: period as LeavePeriod,
    note: typeof note === "string" && note.trim() !== "" ? note.trim().slice(0, 200) : null,
  };
}
