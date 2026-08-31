import { NextRequest, NextResponse } from "next/server";
import { getMonthlyAttendanceLedger } from "@/lib/attendanceExport";
import { getAdminSessionFromRequest } from "@/lib/requireAdminSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveWorkMonth } from "@/lib/workDate";

function formatTime(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

function formatHours(totalMinutes: number | null) {
  if (totalMinutes === null) return "";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function sanitizeFilenamePart(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export async function GET(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const month = resolveWorkMonth(req.nextUrl.searchParams.get("month") ?? undefined);
  const employeeParam = req.nextUrl.searchParams.get("employee");
  const employeeId = employeeParam && employeeParam !== "all" ? employeeParam : undefined;
  const supabase = getSupabaseAdmin();

  try {
    const ledger = await getMonthlyAttendanceLedger(supabase, month, employeeId);
    const rows = [
      ["ชื่อพนักงาน", "รหัสพนักงาน", "วันที่", "เวลาเข้า", "เวลาออก", "ชั่วโมง", "สถานะ"],
      ...ledger.map((row) => [
        row.employeeName,
        row.employeeCode ?? "",
        row.workDate,
        formatTime(row.clockInAt),
        formatTime(row.clockOutAt),
        formatHours(row.totalMinutes),
        row.status,
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
    const employeeSuffix = employeeId
      ? `_${sanitizeFilenamePart(ledger[0]?.employeeCode ?? employeeId)}`
      : "";

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendance_${month}${employeeSuffix}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
