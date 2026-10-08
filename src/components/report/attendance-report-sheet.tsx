import {
  ORGANIZATION_NAME,
  REPORT_STATUS_LABEL,
  REPORT_TITLE,
  type MonthlyReport,
  type ReportApproval,
  type ReportDay,
  type ReportDayStatus,
} from "@/lib/attendanceReport";
import { cn } from "@/lib/utils";

// A4 landscape sheet, sized in mm so the on-screen preview matches the printed page.
// One employee / one month / one page: the month is split into two side-by-side columns
// (days 1–16 and 17–end) so even 31-day months fit with readable row heights.

const STATUS_STYLE: Record<ReportDayStatus, string> = {
  normal: "text-slate-600",
  edited: "bg-sky-50 text-sky-800 ring-1 ring-sky-200",
  incomplete: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  invalid: "bg-rose-600 text-white",
  in_progress: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  leave: "bg-violet-50 text-violet-800 ring-1 ring-violet-200",
  holiday: "text-slate-400",
  no_record: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  not_applicable: "",
};

const WEEKDAY = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

function formatTime(iso: string | null) {
  if (!iso) return "–";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

function formatHours(minutes: number | null) {
  if (minutes === null) return "–";
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

function formatTotal(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} ชม.` : `${h} ชม. ${m} นาที`;
}

function formatThaiMonth(month: string) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${month}-01T00:00:00+07:00`));
}

function formatThaiDate(date: string) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${date}T00:00:00+07:00`));
}

export function formatThaiDateTime(iso: string) {
  const date = new Date(iso);
  const d = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(date);
  return `${d} ${formatTime(iso)} น.`;
}

function DayRow({ day, striped }: { day: ReportDay; striped: boolean }) {
  const dayNumber = Number(day.date.slice(8));
  const weekday = WEEKDAY[new Date(`${day.date}T12:00:00Z`).getUTCDay()];
  const muted = day.status === "holiday" || day.status === "not_applicable";

  return (
    <tr className={cn("report-row", striped && "bg-slate-50/70", muted && "text-slate-400")}>
      <td className="whitespace-nowrap py-[1.1mm] pl-[2mm] pr-[1mm]">
        <span className="inline-block w-[5.5mm] text-right font-semibold tabular-nums">{dayNumber}</span>
        <span className={cn("ml-[1.2mm] text-[7.5pt]", day.isWeekend ? "text-slate-400" : "text-slate-500")}>
          {weekday}
        </span>
      </td>
      <td className="px-[1mm] text-center tabular-nums">{day.clockInAt ? formatTime(day.clockInAt) : "–"}</td>
      <td className="px-[1mm] text-center tabular-nums">{day.clockOutAt ? formatTime(day.clockOutAt) : "–"}</td>
      <td className="px-[1mm] text-center font-medium tabular-nums">{formatHours(day.totalMinutes)}</td>
      <td className="px-[1mm]">
        {REPORT_STATUS_LABEL[day.status] && (
          <span
            className={cn(
              "inline-block whitespace-nowrap rounded-[1mm] px-[1.4mm] py-[0.2mm] text-[7.5pt] leading-tight",
              STATUS_STYLE[day.status]
            )}
          >
            {REPORT_STATUS_LABEL[day.status]}
          </span>
        )}
      </td>
      {/* Notes are truncated on paper; the full text stays in the system. */}
      <td className="max-w-0 truncate pl-[1mm] pr-[2mm] text-[7.5pt] text-slate-500" title={day.note ?? undefined}>
        {day.note}
      </td>
    </tr>
  );
}

function DayTable({ days }: { days: ReportDay[] }) {
  return (
    <table className="w-full table-fixed border-collapse text-[8.5pt] leading-tight">
      <colgroup>
        <col className="w-[15mm]" />
        <col className="w-[11.5mm]" />
        <col className="w-[11.5mm]" />
        <col className="w-[12mm]" />
        <col className="w-[19mm]" />
        <col />
      </colgroup>
      <thead>
        <tr className="bg-[#eef2f8] text-[7.5pt] font-semibold text-[#1b2f55]">
          <th className="py-[1.4mm] pl-[2mm] text-left">วันที่</th>
          <th className="text-center">เข้า</th>
          <th className="text-center">ออก</th>
          <th className="text-center">ชั่วโมง</th>
          <th className="px-[1mm] text-left">สถานะ</th>
          <th className="pl-[1mm] text-left">หมายเหตุ</th>
        </tr>
      </thead>
      <tbody>
        {days.map((day, index) => (
          <DayRow key={day.date} day={day} striped={index % 2 === 1} />
        ))}
      </tbody>
    </table>
  );
}

function SummaryItem({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex-1 border-l border-slate-200 px-[4mm] first:border-l-0 first:pl-0">
      <p className="text-[7.5pt] text-slate-500">{label}</p>
      <p className={cn("mt-[0.5mm] text-[12pt] font-semibold leading-tight text-slate-900", tone)}>{value}</p>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[7pt] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="truncate text-[9.5pt] font-medium text-slate-900">{value}</p>
    </div>
  );
}

export function AttendanceReportSheet({
  report,
  approval,
  qrSvg,
}: {
  report: MonthlyReport;
  // Only an approval whose hash matches the current data; a stale approval must not be printed as valid.
  approval: ReportApproval | null;
  qrSvg: string | null;
}) {
  const half = Math.ceil(report.days.length / 2);
  const left = report.days.slice(0, half);
  const right = report.days.slice(half);
  const { summary } = report;

  return (
    <article className="report-sheet relative mx-auto flex h-[210mm] w-[297mm] flex-col overflow-hidden bg-white px-[11mm] pb-[8mm] pt-[9mm] text-slate-900 shadow-[0_1px_3px_rgba(15,23,42,.08),0_12px_32px_rgba(15,23,42,.10)] print:shadow-none">
      <div className="absolute inset-x-0 top-0 h-[2.2mm] bg-[#1b2f55]" />

      {/* Header */}
      <header className="flex items-end justify-between gap-[6mm] border-b border-slate-200 pb-[3mm]">
        <div className="flex items-center gap-[3mm]">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG must print reliably */}
          <img src="/logo-mark.svg" alt="" className="size-[11mm] rounded-[2.4mm]" />
          <div>
            <p className="text-[10.5pt] font-semibold leading-tight text-[#1b2f55]">{ORGANIZATION_NAME}</p>
            <p className="text-[8pt] text-slate-500">ChulaPD Attendance</p>
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-[17pt] font-bold leading-tight text-[#1b2f55]">{REPORT_TITLE}</h1>
          <p className="text-[10pt] text-slate-600">ประจำเดือน {formatThaiMonth(report.month)}</p>
        </div>
      </header>

      {/* Employee info */}
      <section className="mt-[3mm] grid grid-cols-[1.6fr_0.8fr_1.6fr_1.4fr_1.3fr] gap-[4mm] rounded-[1.5mm] bg-slate-50 px-[4mm] py-[2.2mm]">
        <InfoItem label="ชื่อ-นามสกุล" value={report.employee.name} />
        <InfoItem label="รหัสพนักงาน" value={report.employee.code ?? "–"} />
        <InfoItem label="หน่วยงาน" value={report.employee.department ?? "ศูนย์พาร์กินสันฯ"} />
        <InfoItem
          label="ช่วงวันที่"
          value={`${formatThaiDate(report.periodStart)} – ${formatThaiDate(report.periodEnd)}`}
        />
        <InfoItem label="เลขที่เอกสาร" value={report.documentNumber} />
      </section>

      {/* Monthly summary */}
      <section className="mt-[3mm] flex items-stretch rounded-[1.5mm] border border-slate-200 px-[4mm] py-[2.2mm]">
        <SummaryItem label="วันที่มีการบันทึก" value={`${summary.recordedDays} วัน`} />
        <SummaryItem label="เวลาทำงานรวม" value={formatTotal(summary.totalMinutes)} tone="text-[#1b2f55]" />
        <SummaryItem
          label="ไม่มีข้อมูลการลงเวลา"
          value={`${summary.noRecordDays} วัน`}
          tone={summary.noRecordDays > 0 ? "text-rose-700" : undefined}
        />
        <SummaryItem label="ลางาน" value={`${summary.leaveDays} วัน`} />
        <SummaryItem
          label="แก้ไข/ลงเวลานอกพื้นที่"
          value={`${summary.editedCount} รายการ`}
          tone={summary.editedCount > 0 ? "text-sky-800" : undefined}
        />
        {summary.incompleteDays > 0 && (
          <SummaryItem label="ไม่มีเวลาออก" value={`${summary.incompleteDays} วัน`} tone="text-amber-700" />
        )}
        {summary.invalidDays > 0 && (
          <SummaryItem label="เวลาไม่ถูกต้อง" value={`${summary.invalidDays} วัน`} tone="text-rose-700" />
        )}
      </section>

      {/* Attendance table: two columns */}
      <section className="mt-[3mm] grid grid-cols-2 gap-[5mm]">
        <div className="overflow-hidden rounded-[1.5mm] border border-slate-200">
          <DayTable days={left} />
        </div>
        <div className="overflow-hidden rounded-[1.5mm] border border-slate-200">
          <DayTable days={right} />
        </div>
      </section>

      <p className="mt-[1.6mm] text-[7pt] text-slate-400">
        “ไม่มีข้อมูล” หมายถึงไม่พบข้อมูลการลงเวลาในระบบ ไม่ได้หมายความว่าไม่ได้มาปฏิบัติงาน · เวลาตามเขตเวลาประเทศไทย
        (UTC+7) · วันหยุดในรายงานนับเฉพาะวันเสาร์–อาทิตย์
        {report.monthInProgress && " · เดือนนี้ยังไม่สิ้นสุด ข้อมูลอาจเปลี่ยนแปลง"}
      </p>

      {/* Certification */}
      <footer className="mt-auto grid grid-cols-[1fr_auto] gap-[6mm] border-t border-slate-200 pt-[3mm]">
        <div className="grid grid-cols-[1.25fr_1fr] gap-[6mm]">
          <div>
            <p className="text-[9.5pt] font-semibold text-[#1b2f55]">การรับรอง</p>
            <p className="mt-[1mm] text-[8.5pt] leading-snug text-slate-600">
              ข้าพเจ้าขอรับรองว่าได้ตรวจสอบข้อมูลการปฏิบัติงานตามรายงานฉบับนี้แล้ว
            </p>
            <div className="mt-[2.5mm] grid grid-cols-[auto_1fr] gap-x-[2mm] gap-y-[1.2mm] text-[8.5pt]">
              <span className="text-slate-500">ผู้รับรอง:</span>
              <span className={cn("border-b border-dotted border-slate-300", approval && "font-medium")}>
                {approval?.approver_name ?? " "}
              </span>
              <span className="text-slate-500">ตำแหน่ง:</span>
              <span className={cn("border-b border-dotted border-slate-300", approval && "font-medium")}>
                {approval?.approver_role ?? " "}
              </span>
            </div>
          </div>
          <div className="text-[8.5pt]">
            <div className="grid grid-cols-[auto_1fr] gap-x-[2mm] gap-y-[1.2mm]">
              <span className="text-slate-500">สถานะ:</span>
              {approval ? (
                <span className="inline-flex items-center gap-[1mm] font-semibold text-emerald-700">
                  {/* Inline SVG: the PDF renderer has no system fonts, and Sarabun has no ✓ glyph. */}
                  <svg viewBox="0 0 16 16" className="size-[3.2mm]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 8.5l3.2 3L13 4.5" />
                  </svg>
                  รับรองแล้ว (Digital Approval)
                </span>
              ) : (
                <span className="font-medium text-amber-700">รอการรับรอง</span>
              )}
              <span className="text-slate-500">รับรองเมื่อ:</span>
              <span>{approval ? formatThaiDateTime(approval.approved_at) : "–"}</span>
              <span className="text-slate-500">Verification ID:</span>
              <span className="text-[8pt] tracking-wide">{approval?.verification_id ?? "–"}</span>
              <span className="text-slate-500">Document hash:</span>
              <span className="text-[7pt] tracking-wide text-slate-500">
                {approval ? `${approval.document_hash.slice(0, 16)}…` : `${report.documentHash.slice(0, 16)}…`}
                {approval && approval.report_version > 1 && ` · ฉบับที่ ${approval.report_version}`}
              </span>
            </div>
          </div>
        </div>
        <div className="flex w-[24mm] flex-col items-center justify-center">
          {qrSvg ? (
            <>
              <div className="size-[21mm] [&>svg]:size-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <p className="mt-[0.6mm] text-center text-[6pt] leading-tight text-slate-400">สแกนเพื่อตรวจสอบเอกสาร</p>
            </>
          ) : (
            <div className="grid size-[21mm] place-items-center rounded-[1.5mm] border border-dashed border-slate-300 text-center text-[6.5pt] leading-tight text-slate-400">
              QR ตรวจสอบ
              <br />
              หลังรับรอง
            </div>
          )}
        </div>
      </footer>
    </article>
  );
}
