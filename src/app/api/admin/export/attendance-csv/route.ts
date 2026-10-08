import { NextRequest, NextResponse } from "next/server";
import { REPORT_STATUS_LABEL, buildMonthlyReports } from "@/lib/attendanceReport";
import { getAdminSessionFromRequest } from "@/lib/requireAdminSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveWorkMonth } from "@/lib/workDate";

function formatTime(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
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
    const reports = await buildMonthlyReports(supabase, month, employeeId ? [employeeId] : undefined);

    const rows = [
      ["ชื่อพนักงาน", "รหัสพนักงาน", "วันที่", "เวลาเข้า", "เวลาออก", "ชั่วโมง", "สถานะ", "หมายเหตุ"],
      ...reports.flatMap((report) =>
        report.days.map((day) => [
          report.employee.name,
          report.employee.code ?? "",
          day.date,
          formatTime(day.clockInAt),
          formatTime(day.clockOutAt),
          formatHours(day.totalMinutes),
          day.status === "no_record" ? "ไม่มีข้อมูลการลงเวลา" : REPORT_STATUS_LABEL[day.status],
          day.note ?? "",
        ])
      ),
    ];
    const BOM = String.fromCharCode(0xfeff); // lets Excel detect UTF-8 for Thai text
    const csv = `${BOM}${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
    const employeeSuffix = employeeId
      ? `_${sanitizeFilenamePart(reports[0]?.employee.code ?? employeeId)}`
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
