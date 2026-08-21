import type { EmployeeMonthSummary, EmployeeTodayStatus } from "@/lib/attendanceStats";

function formatTime(iso: string | null) {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

function formatHours(totalMinutes: number) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatThaiMonth(month: string) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${month}-01T00:00:00+07:00`));
}

export function formatTodayStatusReply(displayName: string, status: EmployeeTodayStatus) {
  if (!status?.clock_in_at) {
    return `สถานะวันนี้ของคุณ ${displayName}\nยังไม่ได้ Clock in ครับ`;
  }

  if (!status.clock_out_at) {
    return `สถานะวันนี้ของคุณ ${displayName}\nClock in แล้วตั้งแต่ ${formatTime(status.clock_in_at)} น.\nยังไม่ได้ Clock out`;
  }

  return `สถานะวันนี้ของคุณ ${displayName}\nClock in ${formatTime(status.clock_in_at)} น.\nClock out ${formatTime(status.clock_out_at)} น.\nรวม ${formatHours(status.total_minutes ?? 0)} ชม.`;
}

export function formatMonthSummaryReply(
  displayName: string,
  month: string,
  summary: EmployeeMonthSummary
) {
  return [
    `เดือน${formatThaiMonth(month)}ของคุณ ${displayName}`,
    `มาทำงาน ${summary.daysPresent} วัน`,
    `รวม ${formatHours(summary.totalMinutes)} ชม.`,
    `ลืม Clock out ${summary.missingClockOutDays} วัน`,
    `ตรงเวลา ${summary.onTimeDays} วัน`,
  ].join("\n");
}

export function formatHelpReply(liffUrl: string) {
  return [
    "พิมพ์คำสั่งเหล่านี้เพื่อเช็คข้อมูลครับ",
    "วันนี้ หรือ สถานะ = ดูสถานะลงเวลาวันนี้",
    "เดือนนี้, ชั่วโมง หรือ สรุป = ดูสรุปเดือนนี้",
    `ต้องการ Clock in / Clock out ให้เปิด Rich Menu หรือเข้า ${liffUrl}`,
  ].join("\n");
}

export function formatNotRegisteredReply(liffUrl: string) {
  return [
    "ยังไม่พบข้อมูลพนักงานของ LINE account นี้ครับ",
    "กรุณาเปิดระบบลงเวลาผ่าน Rich Menu หรือ LIFF ก่อน เพื่อเชื่อมบัญชีพนักงาน",
    liffUrl,
  ].join("\n");
}
