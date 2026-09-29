"use client";

import { useEffect, useState } from "react";
import { CalendarOff, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LeavePeriod } from "@/lib/leaves";

type MyLeave = {
  id: string;
  start_date: string;
  end_date: string;
  period: LeavePeriod;
  note: string | null;
  created_by: "admin" | "employee";
};

type LeaveForm = {
  start_date: string;
  end_date: string;
  period: LeavePeriod;
  note: string;
};

const PERIOD_LABEL: Record<LeavePeriod, string> = {
  full: "ทั้งวัน",
  morning: "ครึ่งเช้า",
  afternoon: "ครึ่งบ่าย",
};

function formatLeaveDate(date: string) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${date}T00:00:00+07:00`));
}

function formatLeaveRange(leave: MyLeave) {
  return leave.start_date === leave.end_date
    ? formatLeaveDate(leave.start_date)
    : `${formatLeaveDate(leave.start_date)} – ${formatLeaveDate(leave.end_date)}`;
}

function emptyForm(today: string): LeaveForm {
  return { start_date: today, end_date: today, period: "full", note: "" };
}

export function MyLeavePanel({ today }: { today: string }) {
  const [leaves, setLeaves] = useState<MyLeave[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<LeaveForm>(() => emptyForm(today));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/attendance/my-leaves", { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "โหลดวันลาไม่สำเร็จ");
        setLeaves(data.leaves as MyLeave[]);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLoadError(err instanceof Error ? err.message : "โหลดวันลาไม่สำเร็จ");
      });
    return () => controller.abort();
  }, []);

  async function handleSubmit() {
    setSaving(true);
    try {
      const res = await fetch("/api/attendance/my-leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "แจ้งลาไม่สำเร็จ");
        return;
      }
      setLeaves((prev) =>
        [...(prev ?? []), data.leave as MyLeave].sort((a, b) =>
          a.start_date.localeCompare(b.start_date)
        )
      );
      setForm(emptyForm(today));
      toast.success("แจ้งลาแล้ว ระบบจะไม่ส่งแจ้งเตือนลงเวลาในวันที่ลา");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(leave: MyLeave) {
    setSaving(true);
    try {
      const res = await fetch(`/api/attendance/my-leaves/${leave.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "ยกเลิกวันลาไม่สำเร็จ");
        return;
      }
      setLeaves((prev) => (prev ?? []).filter((l) => l.id !== leave.id));
      toast.success("ยกเลิกวันลาแล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-background p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <CalendarOff className="size-4 text-muted-foreground" />
          วันลาของฉัน
        </div>
        {loadError && (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {loadError}
          </p>
        )}
        {!loadError && leaves === null && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="size-4 animate-spin" />
            กำลังโหลด...
          </div>
        )}
        {leaves && leaves.length === 0 && (
          <p className="text-sm text-muted-foreground">ยังไม่มีวันลาที่กำลังจะถึง</p>
        )}
        {leaves && leaves.length > 0 && (
          <ul className="grid gap-2">
            {leaves.map((leave) => (
              <li
                key={leave.id}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {formatLeaveRange(leave)} · {PERIOD_LABEL[leave.period]}
                  </p>
                  {(leave.note || leave.created_by === "admin") && (
                    <p className="truncate text-xs text-muted-foreground">
                      {[leave.note, leave.created_by === "admin" ? "บันทึกโดยผู้ดูแล" : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <Button
                  aria-label="ยกเลิกวันลา"
                  disabled={saving}
                  onClick={() => handleCancel(leave)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-3 rounded-lg border bg-background p-4">
        <p className="text-sm font-medium">แจ้งลาใหม่</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="my_leave_start">ตั้งแต่</Label>
            <Input
              id="my_leave_start"
              min={today}
              type="date"
              value={form.start_date}
              onChange={(e) => {
                const start = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  start_date: start,
                  end_date: prev.end_date < start ? start : prev.end_date,
                }));
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="my_leave_end">ถึง</Label>
            <Input
              id="my_leave_end"
              min={form.start_date}
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>ช่วงเวลา</Label>
          <Select
            value={form.period}
            onValueChange={(value) => setForm({ ...form, period: value as LeavePeriod })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">ทั้งวัน</SelectItem>
              <SelectItem value="morning">ครึ่งเช้า</SelectItem>
              <SelectItem value="afternoon">ครึ่งบ่าย</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="my_leave_note">หมายเหตุ (ไม่บังคับ)</Label>
          <Input
            id="my_leave_note"
            maxLength={200}
            placeholder="เช่น ลาพักร้อน, ลาป่วย"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>
        <Button
          className="h-11 w-full"
          disabled={saving || !form.start_date}
          onClick={handleSubmit}
          type="button"
        >
          {saving ? "กำลังบันทึก..." : "แจ้งลา"}
        </Button>
        <p className="text-xs text-muted-foreground">
          การแจ้งลาในระบบนี้ใช้เพื่อหยุดการแจ้งเตือนลงเวลาเท่านั้น ยังต้องยื่นใบลาตามระเบียบตามปกติ
        </p>
      </div>
    </div>
  );
}
