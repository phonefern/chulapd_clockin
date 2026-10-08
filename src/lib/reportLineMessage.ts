import type { LineMessage } from "@/lib/lineMessaging";
import type { MonthlyReport, ReportApproval } from "@/lib/attendanceReport";

const NAVY = "#1b2f55";

function thaiMonth(month: string) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${month}-01T00:00:00+07:00`));
}

function thaiDate(iso: string) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

function totalHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} ชม.` : `${h} ชม. ${m} นาที`;
}

function row(label: string, value: string, valueColor = "#111827") {
  return {
    type: "box",
    layout: "horizontal",
    contents: [
      { type: "text", text: label, size: "sm", color: "#6b7280", flex: 4 },
      { type: "text", text: value, size: "sm", color: valueColor, flex: 6, align: "end", wrap: true },
    ],
  };
}

// Flex card telling an employee their monthly report was certified, with a PDF button.
// LINE bots cannot attach files, so the PDF is a (signed, expiring) link; `openExternalBrowser=1`
// makes LINE open it in the phone's browser, which can display/save PDFs reliably.
export function certifiedReportFlex(
  report: MonthlyReport,
  approval: ReportApproval,
  pdfUrl: string,
  myReportsUrl: string
): LineMessage {
  const month = thaiMonth(report.month);
  const external = `${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}openExternalBrowser=1`;

  return {
    type: "flex",
    altText: `รายงานรับรองเวลาปฏิบัติงาน ${month} ได้รับการรับรองแล้ว`,
    contents: {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: NAVY,
        paddingAll: "16px",
        contents: [
          { type: "text", text: "รายงานรับรองเวลาปฏิบัติงาน", color: "#ffffff", weight: "bold", size: "md" },
          { type: "text", text: `ประจำเดือน ${month}`, color: "#c7d2e6", size: "sm", margin: "xs" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: `คุณ${report.employee.name}`, weight: "bold", size: "md", wrap: true },
          { type: "separator", margin: "md" },
          { type: "box", layout: "vertical", spacing: "sm", margin: "md", contents: [
            row("วันที่มีการบันทึก", `${report.summary.recordedDays} วัน`),
            row("เวลาทำงานรวม", totalHours(report.summary.totalMinutes)),
            row("ผู้รับรอง", approval.approver_name),
            row("รับรองเมื่อ", thaiDate(approval.approved_at)),
            row("สถานะ", "รับรองแล้ว", "#047857"),
          ] },
          {
            type: "text",
            text: approval.verification_id,
            size: "xxs",
            color: "#9ca3af",
            margin: "md",
            wrap: true,
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: NAVY,
            height: "sm",
            action: { type: "uri", label: "ดาวน์โหลด PDF", uri: external },
          },
          {
            type: "button",
            style: "link",
            height: "sm",
            action: { type: "uri", label: "รายงานทั้งหมดของฉัน", uri: myReportsUrl },
          },
        ],
      },
    },
  };
}
