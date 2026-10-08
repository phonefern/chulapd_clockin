"use client";

import { useEffect, useState } from "react";
import { FileText, List, X } from "lucide-react";
import { ScaledSheet } from "@/components/report/scaled-sheet";
import { cn } from "@/lib/utils";

// Pre-formatted on the server so this client component needs no report/crypto modules.
export type DayView = {
  date: string;
  day: number;
  weekday: string;
  clockIn: string | null;
  clockOut: string | null;
  hours: string | null;
  status: string;
  label: string;
  note: string | null;
};

export type ReportSummaryView = {
  recordedDays: number;
  totalHours: string;
  noRecordDays: number;
  leaveDays: number;
  editedCount: number;
};

const BADGE: Record<string, string> = {
  normal: "bg-slate-100 text-slate-600",
  edited: "bg-sky-50 text-sky-800 ring-1 ring-sky-200",
  incomplete: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  invalid: "bg-rose-600 text-white",
  in_progress: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  leave: "bg-violet-50 text-violet-800 ring-1 ring-violet-200",
  holiday: "text-slate-400",
  no_record: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  not_applicable: "",
};

type Mode = "list" | "a4";

function DayList({ days }: { days: DayView[] }) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
      {days.map((d) => {
        const muted = d.status === "holiday" || d.status === "not_applicable";
        return (
          <li
            key={d.date}
            className={cn(
              "grid grid-cols-[2.75rem_1fr_auto] items-center gap-x-3 px-3 py-2.5 sm:grid-cols-[3.5rem_9rem_4rem_1fr_auto] sm:px-5",
              muted && "bg-slate-50/60 text-slate-400"
            )}
          >
            <div className="text-center leading-tight">
              <p className={cn("text-base font-semibold", muted ? "text-slate-400" : "text-slate-900")}>{d.day}</p>
              <p className="text-[11px] text-slate-400">{d.weekday}</p>
            </div>
            <div className="min-w-0 sm:contents">
              <p className={cn("text-sm tabular-nums", muted ? "text-slate-400" : "text-slate-800")}>
                {d.clockIn && d.clockOut
                  ? `${d.clockIn} – ${d.clockOut}`
                  : d.clockIn
                    ? `เข้า ${d.clockIn}`
                    : "–"}
                <span className="ml-2 text-xs text-slate-500 sm:hidden">{d.hours && `${d.hours} ชม.`}</span>
              </p>
              <p className="hidden text-sm tabular-nums text-slate-600 sm:block">{d.hours ?? "–"}</p>
              {d.note && <p className="mt-0.5 text-xs text-slate-500 sm:mt-0 sm:truncate">{d.note}</p>}
              {!d.note && <span className="hidden sm:block" />}
            </div>
            {d.label ? (
              <span className={cn("whitespace-nowrap rounded-md px-2 py-0.5 text-xs", BADGE[d.status])}>{d.label}</span>
            ) : (
              <span />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ReportViewer({
  name,
  code,
  monthLabel,
  summary,
  days,
  sheet,
  onClose,
}: {
  name: string;
  code: string | null;
  monthLabel: string;
  summary: ReportSummaryView;
  days: DayView[];
  sheet: React.ReactNode;
  onClose: () => void;
}) {
  // Phones/tablets get the readable list first; wide screens get the document itself.
  const [mode, setMode] = useState<Mode>(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches ? "a4" : "list"
  );

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      aria-label={`รายงานของ ${name}`}
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col bg-slate-100 lg:bg-slate-900/40 lg:p-6"
      role="dialog"
    >
      <div className="mx-auto flex h-full w-full max-w-[1200px] flex-col overflow-hidden bg-slate-100 lg:rounded-2xl lg:shadow-2xl">
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{name}</p>
            <p className="truncate text-xs text-slate-500">
              {code ? `${code} · ` : ""}ประจำเดือน {monthLabel}
            </p>
          </div>
          <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5 text-sm" role="tablist">
            {(
              [
                ["list", "สรุปรายวัน", List],
                ["a4", "เอกสาร A4", FileText],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                aria-selected={mode === value}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors",
                  mode === value ? "bg-white text-[#1b2f55] shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
                onClick={() => setMode(value)}
                role="tab"
                type="button"
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
          <button
            aria-label="ปิด"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            onClick={onClose}
            type="button"
          >
            <X className="size-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5">
          {mode === "list" ? (
            <div className="mx-auto max-w-3xl">
              <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {[
                  ["มีบันทึก", `${summary.recordedDays} วัน`],
                  ["เวลารวม", summary.totalHours],
                  ["ไม่มีข้อมูล", `${summary.noRecordDays} วัน`],
                  ["ลางาน", `${summary.leaveDays} วัน`],
                  ["แก้ไข", `${summary.editedCount} รายการ`],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                    <p className="truncate text-[11px] text-slate-500">{label}</p>
                    <p className="truncate text-sm font-semibold text-slate-900 sm:text-base">{value}</p>
                  </div>
                ))}
              </div>
              <DayList days={days} />
              <p className="mt-3 text-xs text-slate-500">
                “ไม่มีข้อมูล” หมายถึงไม่พบข้อมูลการลงเวลาในระบบ ไม่ได้หมายความว่าไม่ได้มาปฏิบัติงาน
              </p>
            </div>
          ) : (
            <ScaledSheet>{sheet}</ScaledSheet>
          )}
        </div>
      </div>
    </div>
  );
}
