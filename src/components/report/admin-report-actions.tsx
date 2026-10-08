"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Send, X } from "lucide-react";
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

function saveApprover(name: string, role: string) {
  try {
    window.localStorage.setItem(APPROVER_STORAGE_KEY, JSON.stringify({ name, role }));
  } catch {
    // Remembering the approver is only a convenience.
  }
}

// ---------------------------------------------------------------------------------------------
// Push certified reports to employees on LINE.

export function SendReportsButton({
  month,
  monthLabel,
  employees,
  label,
  variant = "outline",
  size = "sm",
}: {
  month: string;
  monthLabel: string;
  employees: { id: string; name: string }[];
  label: string;
  variant?: "outline" | "default" | "ghost";
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      const res = await fetch("/api/admin/reports/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, employeeIds: employees.map((e) => e.id) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "ส่งไม่สำเร็จ");
        return;
      }
      if (data.sent > 0) toast.success(`ส่งรายงานทาง LINE แล้ว ${data.sent} คน`);
      for (const s of data.skipped as { name: string; reason: string }[]) {
        toast.error(`${s.name}: ${s.reason}`);
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Button
        className="gap-1.5"
        disabled={employees.length === 0}
        onClick={() => setOpen(true)}
        size={size}
        type="button"
        variant={variant}
      >
        <Send className="size-4" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ส่งรายงานที่รับรองแล้วทาง LINE</DialogTitle>
            <DialogDescription>ประจำเดือน {monthLabel}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 text-sm">
            <p>
              พนักงานจะได้รับการ์ดพร้อมปุ่ม <strong>ดาวน์โหลด PDF</strong> ({employees.length} คน)
            </p>
            {employees.length <= 12 && (
              <p className="text-muted-foreground">{employees.map((e) => e.name).join(", ")}</p>
            )}
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
              ใช้โควตาข้อความ LINE OA คนละ 1 ข้อความ
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              ยกเลิก
            </Button>
            <Button
              className="bg-[#1b2f55] text-white hover:bg-[#1b2f55]/90"
              disabled={sending}
              onClick={handleSend}
              type="button"
            >
              {sending ? "กำลังส่ง..." : `ส่ง ${employees.length} คน`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Create a link a supervisor can open (no login) to approve reports.

type LinkEmployee = { id: string; name: string; code: string | null; state: "approved" | "pending" | "stale" };

export function CreateApprovalLinkButton({
  month,
  monthLabel,
  employees,
}: {
  month: string;
  monthLabel: string;
  employees: LinkEmployee[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function openDialog() {
    const saved = loadSavedApprover();
    setName(saved.name);
    setRole(saved.role);
    setSelected(new Set(employees.filter((e) => e.state !== "approved").map((e) => e.id)));
    setUrl(null);
    setCopied(false);
    setOpen(true);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/approval-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          employeeIds: employees.filter((e) => selected.has(e.id)).map((e) => e.id),
          approverName: name,
          approverRole: role,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "สร้างลิงก์ไม่สำเร็จ");
        return;
      }
      saveApprover(name.trim(), role.trim());
      setUrl(data.url);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("คัดลอกลิงก์แล้ว");
    } catch {
      toast.error("คัดลอกไม่สำเร็จ กรุณาคัดลอกเอง");
    }
  }

  const shareText = url
    ? `รบกวนตรวจสอบและรับรองรายงานเวลาปฏิบัติงาน ประจำเดือน ${monthLabel}\n${url}`
    : "";

  return (
    <>
      <Button className="gap-2" onClick={openDialog} type="button" variant="outline">
        <Link2 className="size-4" />
        ส่งลิงก์ให้หัวหน้ารับรอง
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>ลิงก์ให้หัวหน้ารับรอง</DialogTitle>
            <DialogDescription>
              หัวหน้าเปิดลิงก์ได้ทันทีโดยไม่ต้องล็อกอิน · ประจำเดือน {monthLabel} · ใช้ได้ 14 วัน
            </DialogDescription>
          </DialogHeader>

          {url ? (
            <div className="grid gap-3">
              <p className="text-sm">ส่งลิงก์นี้ให้ {name} เท่านั้น — ใครมีลิงก์ก็รับรองในนามผู้รับรองนี้ได้</p>
              <div className="flex gap-2">
                <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
                <Button className="shrink-0 gap-1.5" onClick={copy} type="button" variant="outline">
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  คัดลอก
                </Button>
              </div>
              <a
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#06c755] text-sm font-medium text-white hover:bg-[#06c755]/90"
                href={`https://line.me/R/share?text=${encodeURIComponent(shareText)}`}
                rel="noreferrer"
                target="_blank"
              >
                แชร์ผ่าน LINE
              </a>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="link_approver_name">ชื่อผู้รับรอง</Label>
                <Input id="link_approver_name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="link_approver_role">ตำแหน่ง</Label>
                <Input
                  id="link_approver_role"
                  maxLength={120}
                  placeholder="เช่น หัวหน้าศูนย์"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>รายงานที่ให้รับรอง ({selected.size} คน)</Label>
                <ul className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border p-2">
                  {employees.map((e) => (
                    <li key={e.id}>
                      <label className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted/60">
                        <input
                          checked={selected.has(e.id)}
                          className="size-4 accent-[#1b2f55]"
                          onChange={() => toggle(e.id)}
                          type="checkbox"
                        />
                        <span className="flex-1 truncate">{e.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {e.state === "approved" ? "รับรองแล้ว" : e.state === "stale" ? "ต้องรับรองใหม่" : e.code}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setOpen(false)} type="button" variant="outline">
              {url ? "ปิด" : "ยกเลิก"}
            </Button>
            {!url && (
              <Button
                className="bg-[#1b2f55] text-white hover:bg-[#1b2f55]/90"
                disabled={saving || selected.size === 0 || !name.trim() || !role.trim()}
                onClick={handleCreate}
                type="button"
              >
                {saving ? "กำลังสร้าง..." : "สร้างลิงก์"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------------------------

export function RevokeLinkButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function revoke() {
    if (!window.confirm("ยกเลิกลิงก์นี้? หัวหน้าจะเปิดลิงก์ไม่ได้อีก (รายงานที่รับรองไปแล้วยังคงอยู่)")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/approval-links/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "ยกเลิกไม่สำเร็จ");
        return;
      }
      toast.success("ยกเลิกลิงก์แล้ว");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button className="gap-1 text-slate-500" disabled={busy} onClick={revoke} size="sm" type="button" variant="ghost">
      <X className="size-4" />
      ยกเลิก
    </Button>
  );
}
