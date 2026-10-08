"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const APPROVER_STORAGE_KEY = "chulapd-report-approver";

function loadSavedApprover(): { name: string; role: string } {
  try {
    const saved = JSON.parse(window.localStorage.getItem(APPROVER_STORAGE_KEY) ?? "{}");
    return { name: saved.name ?? "", role: saved.role ?? "" };
  } catch {
    return { name: "", role: "" };
  }
}

export function ApproveReportButton({
  employeeId,
  employeeName,
  month,
  monthLabel,
  documentHash,
  monthInProgress,
  reapprove,
}: {
  employeeId: string;
  employeeName: string;
  month: string;
  monthLabel: string;
  documentHash: string;
  monthInProgress: boolean;
  reapprove: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  function openDialog() {
    const saved = loadSavedApprover();
    setName(saved.name);
    setRole(saved.role);
    setConfirmed(false);
    setOpen(true);
  }

  async function handleApprove() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/reports/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, month, documentHash, approverName: name, approverRole: role }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "รับรองไม่สำเร็จ");
        if (res.status === 409) router.refresh();
        return;
      }
      try {
        window.localStorage.setItem(APPROVER_STORAGE_KEY, JSON.stringify({ name: name.trim(), role: role.trim() }));
      } catch {
        // Remembering the approver is only a convenience.
      }
      toast.success(`รับรองแล้ว · ${data.approval.verification_id}`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button className="gap-2 bg-[#1b2f55] text-white hover:bg-[#1b2f55]/90" onClick={openDialog} type="button">
        <ShieldCheck className="size-4" />
        {reapprove ? "รับรองฉบับแก้ไข" : "ตรวจสอบและรับรอง"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>รับรองรายงานเวลาปฏิบัติงาน</DialogTitle>
            <DialogDescription>
              {employeeName} · ประจำเดือน {monthLabel}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {monthInProgress && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                เดือนนี้ยังไม่สิ้นสุด หากข้อมูลเปลี่ยนหลังรับรอง ระบบจะแสดงว่าต้องรับรองใหม่
              </p>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="approver_name">ชื่อผู้รับรอง</Label>
              <Input id="approver_name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="approver_role">ตำแหน่ง</Label>
              <Input
                id="approver_role"
                maxLength={120}
                placeholder="เช่น หัวหน้าศูนย์"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
            <label className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
              <input
                checked={confirmed}
                className="mt-0.5 size-4 accent-[#1b2f55]"
                onChange={(e) => setConfirmed(e.target.checked)}
                type="checkbox"
              />
              ข้าพเจ้าขอรับรองว่าได้ตรวจสอบข้อมูลการปฏิบัติงานตามรายงานฉบับนี้แล้ว
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} type="button">
              ยกเลิก
            </Button>
            <Button
              className="bg-[#1b2f55] text-white hover:bg-[#1b2f55]/90"
              disabled={saving || !confirmed || !name.trim() || !role.trim()}
              onClick={handleApprove}
              type="button"
            >
              {saving ? "กำลังบันทึก..." : "ยืนยันการรับรอง"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
