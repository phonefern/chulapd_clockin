import { createHash, randomInt } from "node:crypto";
import type { LeavePeriod } from "@/lib/leaves";
import type { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  enumerateWorkDates,
  formatDateKeyInBangkok,
  lastDayOfMonth,
  todayInBangkok,
} from "@/lib/workDate";

type Supabase = ReturnType<typeof getSupabaseAdmin>;

export const ORGANIZATION_NAME = "ศูนย์พาร์กินสันและกลุ่มโรคความเคลื่อนไหวผิดปกติ";
export const REPORT_TITLE = "รายงานรับรองเวลาปฏิบัติงาน";

export type ReportDayStatus =
  | "normal" // clocked in and out
  | "edited" // has times, but an admin edited them or the clock-out was self-reported remotely
  | "incomplete" // clocked in on a past day, never clocked out
  | "in_progress" // clocked in today, not clocked out yet — not a problem
  | "invalid" // clock-out earlier than clock-in (bad edit) — excluded from totals until fixed
  | "leave" // no times, on leave
  | "holiday" // weekend, no times
  | "no_record" // working day with no attendance data at all (NOT necessarily absent)
  | "not_applicable"; // future day, or before the employee was enrolled

export const REPORT_STATUS_LABEL: Record<ReportDayStatus, string> = {
  normal: "ปกติ",
  edited: "แก้ไขแล้ว",
  incomplete: "ไม่มีเวลาออก",
  in_progress: "กำลังทำงาน",
  invalid: "เวลาไม่ถูกต้อง",
  leave: "ลางาน",
  holiday: "วันหยุด",
  no_record: "ไม่มีข้อมูล",
  not_applicable: "",
};

const LEAVE_PERIOD_TEXT: Record<LeavePeriod, string> = {
  full: "ลาทั้งวัน",
  morning: "ลาครึ่งเช้า",
  afternoon: "ลาครึ่งบ่าย",
};

export type ReportDay = {
  date: string;
  isWeekend: boolean;
  clockInAt: string | null;
  clockOutAt: string | null;
  totalMinutes: number | null;
  status: ReportDayStatus;
  note: string | null;
};

export type ReportEmployee = {
  id: string;
  code: string | null;
  name: string;
  department: string | null;
};

export type ReportSummary = {
  recordedDays: number;
  totalMinutes: number;
  noRecordDays: number;
  leaveDays: number;
  editedCount: number;
  incompleteDays: number;
  invalidDays: number;
};

export type MonthlyReport = {
  month: string;
  periodStart: string;
  periodEnd: string;
  // True while the month is still running: future days are blank and the totals will change.
  monthInProgress: boolean;
  documentNumber: string;
  employee: ReportEmployee;
  days: ReportDay[];
  summary: ReportSummary;
  documentHash: string;
};

type EmployeeRow = {
  id: string;
  employee_code: string | null;
  name: string;
  display_name: string | null;
  department: string | null;
  created_at: string;
};

type AttendanceRow = {
  id: string;
  work_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  total_minutes: number | null;
  clock_out_method: "geofence" | "remote" | null;
  clock_out_note: string | null;
};

type LeaveRow = {
  start_date: string;
  end_date: string;
  period: LeavePeriod;
  note: string | null;
};

export function documentNumberFor(month: string, employee: { id: string; code: string | null }) {
  const [year, mm] = month.split("-");
  return `ATT-${year}-${mm}-${employee.code ?? employee.id.slice(0, 8).toUpperCase()}`;
}

// Unambiguous characters only (no 0/O, 1/I/L) so the ID can be read off paper.
const VERIFICATION_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newVerificationId(documentNumber: string) {
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += VERIFICATION_ALPHABET[randomInt(VERIFICATION_ALPHABET.length)];
  return `${documentNumber}-${suffix}`;
}

// `date` is a calendar date (YYYY-MM-DD); noon UTC keeps it on the same calendar day.
function isWeekend(date: string) {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

// The part of the report that gets certified. Anything that changes this changes the hash,
// which is how /verify detects edits made after approval.
export function reportSnapshot(report: Omit<MonthlyReport, "documentHash">) {
  return {
    documentNumber: report.documentNumber,
    month: report.month,
    employee: report.employee,
    days: report.days.map((d) => [d.date, d.clockInAt, d.clockOutAt, d.totalMinutes, d.status, d.note]),
    summary: report.summary,
  };
}

export function hashSnapshot(snapshot: unknown) {
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

function joinNotes(...parts: (string | null | undefined)[]) {
  const text = parts.filter(Boolean).join(" · ");
  return text === "" ? null : text;
}

// PostgREST puts `.in()` filters in the URL; keep each request well under URL length limits.
const IN_FILTER_CHUNK = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function composeReport(
  employeeRow: EmployeeRow,
  attendanceRows: AttendanceRow[],
  leaves: LeaveRow[],
  editedIds: Set<string>,
  month: string,
  today: string
): MonthlyReport {
  const periodStart = `${month}-01`;
  const periodEnd = lastDayOfMonth(month);
  const attendanceByDate = new Map(attendanceRows.map((row) => [row.work_date, row]));
  const enrolledOn = formatDateKeyInBangkok(new Date(employeeRow.created_at));

  const days: ReportDay[] = enumerateWorkDates(periodStart, periodEnd).map((date) => {
    const weekend = isWeekend(date);
    const attendance = attendanceByDate.get(date);
    const leave = leaves.find((l) => l.start_date <= date && l.end_date >= date);
    const leaveNote = leave ? joinNotes(LEAVE_PERIOD_TEXT[leave.period], leave.note) : null;

    if (attendance?.clock_in_at) {
      const remote = attendance.clock_out_method === "remote";
      const edited = editedIds.has(attendance.id);
      const invalid =
        !!attendance.clock_out_at &&
        new Date(attendance.clock_out_at).getTime() < new Date(attendance.clock_in_at).getTime();
      let status: ReportDayStatus = "normal";
      if (!attendance.clock_out_at) status = date < today ? "incomplete" : "in_progress";
      else if (invalid) status = "invalid";
      else if (edited || remote) status = "edited";

      return {
        date,
        isWeekend: weekend,
        clockInAt: attendance.clock_in_at,
        clockOutAt: attendance.clock_out_at,
        totalMinutes: invalid ? null : attendance.total_minutes,
        status,
        note: joinNotes(
          invalid ? "เวลาออกก่อนเวลาเข้า กรุณาแก้ไขเวลา" : null,
          leave && leave.period !== "full" ? LEAVE_PERIOD_TEXT[leave.period] : null,
          remote ? joinNotes("ลงเวลาออกนอกพื้นที่", attendance.clock_out_note) : null,
          edited ? "แก้ไขเวลาโดยผู้ดูแล" : null,
          !attendance.clock_out_at && date < today ? "ไม่มีการลงเวลาออก" : null
        ),
      };
    }

    let status: ReportDayStatus;
    let note: string | null = null;
    if (date > today || date < enrolledOn) {
      status = "not_applicable";
      note = date < enrolledOn ? "ก่อนลงทะเบียนในระบบ" : null;
    } else if (weekend) {
      status = "holiday";
    } else if (leave) {
      status = "leave";
      note = leaveNote;
    } else {
      status = "no_record";
    }

    return {
      date,
      isWeekend: weekend,
      clockInAt: null,
      clockOutAt: null,
      totalMinutes: null,
      status,
      note,
    };
  });

  const summary: ReportSummary = {
    recordedDays: days.filter((d) => d.clockInAt).length,
    totalMinutes: days.reduce((sum, d) => sum + (d.totalMinutes ?? 0), 0),
    noRecordDays: days.filter((d) => d.status === "no_record").length,
    leaveDays: days.filter((d) => d.status === "leave").length,
    editedCount: days.filter((d) => d.status === "edited").length,
    incompleteDays: days.filter((d) => d.status === "incomplete").length,
    invalidDays: days.filter((d) => d.status === "invalid").length,
  };

  const employee: ReportEmployee = {
    id: employeeRow.id,
    code: employeeRow.employee_code,
    name: employeeRow.display_name ?? employeeRow.name,
    department: employeeRow.department,
  };

  const report = {
    month,
    periodStart,
    periodEnd,
    monthInProgress: periodEnd >= today,
    documentNumber: documentNumberFor(month, employee),
    employee,
    days,
    summary,
  };

  return { ...report, documentHash: hashSnapshot(reportSnapshot(report)) };
}

// Builds reports for many employees with a fixed number of queries (not one batch per employee).
// Without `employeeIds`, covers every active employee, ordered by employee code.
export async function buildMonthlyReports(
  supabase: Supabase,
  month: string,
  employeeIds?: string[]
): Promise<MonthlyReport[]> {
  const periodStart = `${month}-01`;
  const periodEnd = lastDayOfMonth(month);

  let employeesQuery = supabase
    .from("employees")
    .select("id, employee_code, name, display_name, department, created_at")
    .order("employee_code", { ascending: true });
  employeesQuery = employeeIds ? employeesQuery.in("id", employeeIds) : employeesQuery.eq("active", true);

  const { data: employeesData, error: employeesError } = await employeesQuery;
  if (employeesError) throw new Error(employeesError.message);
  const employees = (employeesData ?? []) as EmployeeRow[];
  if (employees.length === 0) return [];
  const ids = employees.map((e) => e.id);

  const [attendanceRes, leavesRes] = await Promise.all([
    supabase
      .from("attendance")
      .select(
        "id, employee_id, work_date, clock_in_at, clock_out_at, total_minutes, clock_out_method, clock_out_note"
      )
      .in("employee_id", ids)
      .gte("work_date", periodStart)
      .lte("work_date", periodEnd),
    supabase
      .from("employee_leaves")
      .select("employee_id, start_date, end_date, period, note")
      .in("employee_id", ids)
      .lte("start_date", periodEnd)
      .gte("end_date", periodStart),
  ]);
  if (attendanceRes.error) throw new Error(attendanceRes.error.message);
  if (leavesRes.error) throw new Error(leavesRes.error.message);

  const attendanceRows = (attendanceRes.data ?? []) as (AttendanceRow & { employee_id: string })[];
  const leaveRows = (leavesRes.data ?? []) as (LeaveRow & { employee_id: string })[];

  const editedIds = new Set<string>();
  const auditResults = await Promise.all(
    chunk(
      attendanceRows.map((row) => row.id),
      IN_FILTER_CHUNK
    ).map((attendanceIds) =>
      supabase
        .from("audit_logs")
        .select("entity_id")
        .eq("entity_type", "attendance")
        .eq("action", "admin_edit_attendance")
        .in("entity_id", attendanceIds)
    )
  );
  for (const { data, error } of auditResults) {
    if (error) throw new Error(error.message);
    for (const audit of data ?? []) editedIds.add(audit.entity_id as string);
  }

  const today = todayInBangkok();
  return employees.map((employee) =>
    composeReport(
      employee,
      attendanceRows.filter((row) => row.employee_id === employee.id),
      leaveRows.filter((row) => row.employee_id === employee.id),
      editedIds,
      month,
      today
    )
  );
}

export async function buildMonthlyReport(
  supabase: Supabase,
  employeeId: string,
  month: string
): Promise<MonthlyReport | null> {
  const [report] = await buildMonthlyReports(supabase, month, [employeeId]);
  return report ?? null;
}

export type ReportApproval = {
  id: string;
  verification_id: string;
  employee_id: string;
  report_month: string;
  report_version: number;
  document_hash: string;
  approver_name: string;
  approver_role: string;
  approver_email: string | null;
  approved_at: string;
};

export const APPROVAL_COLUMNS =
  "id, verification_id, employee_id, report_month, report_version, document_hash, approver_name, approver_role, approver_email, approved_at";

export async function getLatestApprovals(
  supabase: Supabase,
  month: string,
  employeeId?: string
): Promise<Map<string, ReportApproval>> {
  let query = supabase
    .from("attendance_report_approvals")
    .select(APPROVAL_COLUMNS)
    .eq("report_month", month)
    .order("report_version", { ascending: true });
  if (employeeId) query = query.eq("employee_id", employeeId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Ascending order, so later versions overwrite earlier ones.
  const latest = new Map<string, ReportApproval>();
  for (const row of (data ?? []) as ReportApproval[]) latest.set(row.employee_id, row);
  return latest;
}

export type ApprovalState = "approved" | "stale" | "pending";

// "stale" = an approval exists but the attendance data changed afterwards, so it must be re-approved.
export function approvalStateFor(report: MonthlyReport, latest: ReportApproval | undefined): ApprovalState {
  if (!latest) return "pending";
  return latest.document_hash === report.documentHash ? "approved" : "stale";
}
