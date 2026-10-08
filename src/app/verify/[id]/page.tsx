import type { Metadata } from "next";
import { Sarabun } from "next/font/google";
import { AlertTriangle, CircleCheck, CircleX, Info } from "lucide-react";
import { formatThaiDateTime } from "@/components/report/attendance-report-sheet";
import {
  APPROVAL_COLUMNS,
  ORGANIZATION_NAME,
  REPORT_TITLE,
  buildMonthlyReport,
  getLatestApprovals,
  type ReportApproval,
} from "@/lib/attendanceReport";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { cn } from "@/lib/utils";

const sarabun = Sarabun({ subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "ตรวจสอบเอกสาร · ChulaPD Attendance",
  robots: { index: false, follow: false },
};

type Snapshot = {
  documentNumber: string;
  employee: { name: string; code: string | null };
  summary: { recordedDays: number; totalMinutes: number };
};

type VerifyState = "valid" | "superseded" | "changed" | "not_found";

const STATE_VIEW: Record<VerifyState, { title: string; detail: string; tone: string; icon: typeof CircleCheck }> = {
  valid: {
    title: "เอกสารถูกต้อง",
    detail: "ข้อมูลในระบบตรงกับเอกสารที่ได้รับการรับรอง",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CircleCheck,
  },
  superseded: {
    title: "มีฉบับรับรองที่ใหม่กว่า",
    detail: "เอกสารนี้เคยได้รับการรับรอง แต่ภายหลังมีการรับรองฉบับแก้ไขแล้ว กรุณาใช้ฉบับล่าสุด",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
    icon: Info,
  },
  changed: {
    title: "ข้อมูลเปลี่ยนแปลงหลังการรับรอง",
    detail: "ข้อมูลการลงเวลาในระบบถูกแก้ไขหลังจากเอกสารนี้ได้รับการรับรอง และยังไม่ได้รับรองฉบับใหม่",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
    icon: AlertTriangle,
  },
  not_found: {
    title: "ไม่พบเอกสาร",
    detail: "ไม่พบ Verification ID นี้ในระบบ กรุณาตรวจสอบรหัสอีกครั้ง",
    tone: "border-rose-200 bg-rose-50 text-rose-800",
    icon: CircleX,
  },
};

function formatThaiMonth(month: string) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${month}-01T00:00:00+07:00`));
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid gap-0.5 border-b border-slate-100 py-3 last:border-b-0 sm:grid-cols-[160px_1fr] sm:gap-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className={cn("text-sm font-medium text-slate-900", mono && "break-all font-mono text-xs")}>{value}</dd>
    </div>
  );
}

export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const verificationId = decodeURIComponent(id).trim().toUpperCase();
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from("attendance_report_approvals")
    .select(`${APPROVAL_COLUMNS}, snapshot`)
    .eq("verification_id", verificationId)
    .maybeSingle();

  const approval = data as (ReportApproval & { snapshot: Snapshot }) | null;
  let state: VerifyState = "not_found";
  if (approval) {
    const [current, latest] = await Promise.all([
      buildMonthlyReport(supabase, approval.employee_id, approval.report_month),
      getLatestApprovals(supabase, approval.report_month, approval.employee_id),
    ]);
    const latestVersion = latest.get(approval.employee_id)?.report_version ?? approval.report_version;
    if (latestVersion > approval.report_version) state = "superseded";
    else if (current?.documentHash !== approval.document_hash) state = "changed";
    else state = "valid";
  }

  const view = STATE_VIEW[state];
  const Icon = view.icon;

  return (
    <main className={cn(sarabun.className, "min-h-screen bg-slate-100 px-4 py-10")}>
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- small static SVG */}
          <img src="/logo-mark.svg" alt="" className="size-10 rounded-xl" />
          <div>
            <p className="text-sm font-semibold text-[#1b2f55]">{ORGANIZATION_NAME}</p>
            <p className="text-xs text-slate-500">ระบบตรวจสอบเอกสาร · ChulaPD Attendance</p>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="h-1.5 bg-[#1b2f55]" />
          <div className="p-6">
            <div className={cn("flex items-start gap-3 rounded-xl border p-4", view.tone)}>
              <Icon className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-semibold">{view.title}</p>
                <p className="mt-0.5 text-sm opacity-90">{view.detail}</p>
              </div>
            </div>

            {approval && (
              <dl className="mt-5">
                <Field label="ชื่อเอกสาร" value={REPORT_TITLE} />
                <Field label="เลขที่เอกสาร" value={approval.snapshot.documentNumber} />
                <Field
                  label="พนักงาน"
                  value={`${approval.snapshot.employee.name}${approval.snapshot.employee.code ? ` (${approval.snapshot.employee.code})` : ""}`}
                />
                <Field label="ประจำเดือน" value={formatThaiMonth(approval.report_month)} />
                <Field label="ผู้รับรอง" value={`${approval.approver_name} · ${approval.approver_role}`} />
                <Field label="วันที่รับรอง" value={formatThaiDateTime(approval.approved_at)} />
                <Field label="ฉบับที่" value={String(approval.report_version)} />
                <Field label="Verification ID" value={approval.verification_id} mono />
                <Field label="Document hash (SHA-256)" value={approval.document_hash} mono />
              </dl>
            )}
            {!approval && (
              <p className="mt-5 text-sm text-slate-500">
                รหัสที่ค้นหา: <span className="font-mono">{verificationId}</span>
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
