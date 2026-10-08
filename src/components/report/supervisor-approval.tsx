"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, CircleCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SupervisorItem = {
  employeeId: string;
  name: string;
  code: string | null;
  state: "approved" | "pending" | "stale";
  documentHash: string;
  recordedDays: number;
  totalMinutes: number;
  noRecordDays: number;
  editedCount: number;
  warnings: string[];
};

function formatTotal(minutes: number) {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")} ชม.`;
}

export function SupervisorApproval({
  token,
  items,
  sheets,
  approverName,
  approverRole,
}: {
  token: string;
  items: SupervisorItem[];
  sheets: Record<string, React.ReactNode>;
  approverName: string;
  approverRole: string;
}) {
  const router = useRouter();
  const pendingIds = items.filter((i) => i.state !== "approved").map((i) => i.employeeId);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(pendingIds));
  const [open, setOpen] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleApprove() {
    setSaving(true);
    try {
      const res = await fetch(`/api/approve/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items
            .filter((i) => selected.has(i.employeeId) && i.state !== "approved")
            .map((i) => ({ employeeId: i.employeeId, documentHash: i.documentHash })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "รับรองไม่สำเร็จ");
        return;
      }
      const results = data.results as { ok: boolean; error?: string }[];
      const okCount = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);
      if (okCount > 0) toast.success(`รับรองแล้ว ${okCount} รายงาน`);
      if (failed.length > 0) toast.error(`${failed.length} รายงานไม่สำเร็จ: ${failed[0].error}`);
      setConfirmed(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const selectedPending = items.filter((i) => selected.has(i.employeeId) && i.state !== "approved").length;

  return (
    <>
      <ul className="grid gap-3">
        {items.map((item) => {
          const approved = item.state === "approved";
          const isOpen = open === item.employeeId;
          return (
            <li key={item.employeeId} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start gap-3 p-4">
                {approved ? (
                  <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                ) : (
                  <input
                    aria-label={`เลือก ${item.name}`}
                    checked={selected.has(item.employeeId)}
                    className="mt-1 size-5 shrink-0 accent-[#1b2f55]"
                    onChange={() => toggle(item.employeeId)}
                    type="checkbox"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    {item.code && <span className="text-xs text-slate-400">{item.code}</span>}
                    {approved && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        รับรองแล้ว
                      </span>
                    )}
                    {item.state === "stale" && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        ฉบับแก้ไข
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    มีบันทึก {item.recordedDays} วัน · {formatTotal(item.totalMinutes)}
                    {item.noRecordDays > 0 && ` · ไม่มีข้อมูล ${item.noRecordDays} วัน`}
                    {item.editedCount > 0 && ` · แก้ไข ${item.editedCount}`}
                  </p>
                  {item.warnings.length > 0 && (
                    <p className="mt-1 flex items-start gap-1 text-xs text-rose-700">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      {item.warnings.join(" · ")}
                    </p>
                  )}
                </div>
              </div>
              <button
                className="flex w-full items-center justify-center gap-1 border-t border-slate-100 py-2.5 text-sm font-medium text-[#1b2f55] hover:bg-slate-50"
                onClick={() => setOpen(isOpen ? null : item.employeeId)}
                type="button"
              >
                {isOpen ? "ซ่อนรายงาน" : "ดูรายงานฉบับเต็ม"}
                <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && <div className="border-t border-slate-100 bg-slate-100 p-2">{sheets[item.employeeId]}</div>}
            </li>
          );
        })}
      </ul>

      {pendingIds.length > 0 && (
        <div className="sticky bottom-0 mt-6 -mx-4 border-t border-slate-200 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              checked={confirmed}
              className="mt-0.5 size-4 shrink-0 accent-[#1b2f55]"
              onChange={(e) => setConfirmed(e.target.checked)}
              type="checkbox"
            />
            ข้าพเจ้า {approverName} ({approverRole}) ขอรับรองว่าได้ตรวจสอบข้อมูลการปฏิบัติงานตามรายงานที่เลือกแล้ว
          </label>
          <Button
            className="mt-3 h-12 w-full gap-2 bg-[#1b2f55] text-base text-white hover:bg-[#1b2f55]/90"
            disabled={!confirmed || selectedPending === 0 || saving}
            onClick={handleApprove}
            type="button"
          >
            <ShieldCheck className="size-5" />
            {saving ? "กำลังบันทึก..." : `รับรอง ${selectedPending} รายงาน`}
          </Button>
        </div>
      )}
    </>
  );
}
