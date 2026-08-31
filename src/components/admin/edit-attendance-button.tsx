"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil } from "lucide-react";
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

type EditAttendanceButtonProps = {
  attendanceId: string;
  employeeName: string;
  workDateLabel: string;
  clockInAt: string | null;
  clockOutAt: string | null;
};

function formatTimeInput(iso: string | null) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).formatToParts(new Date(iso));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";
  return hour && minute ? `${hour}:${minute}` : "";
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

export function EditAttendanceButton({
  attendanceId,
  employeeName,
  workDateLabel,
  clockInAt,
  clockOutAt,
}: EditAttendanceButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clockInTime, setClockInTime] = useState(() => formatTimeInput(clockInAt));
  const [clockOutTime, setClockOutTime] = useState(() => formatTimeInput(clockOutAt));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function resetForm(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setClockInTime(formatTimeInput(clockInAt));
      setClockOutTime(formatTimeInput(clockOutAt));
      setError(null);
    }
  }

  async function handleSave() {
    setError(null);
    if (clockInTime && clockOutTime && timeToMinutes(clockOutTime) < timeToMinutes(clockInTime)) {
      setError("เวลาออกต้องไม่เร็วกว่าเวลาเข้า");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/attendance/${attendanceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clockInTime: clockInTime || null,
          clockOutTime: clockOutTime || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "แก้ไขเวลาไม่สำเร็จ");
        return;
      }
      toast.success("บันทึกเวลาแล้ว");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "แก้ไขเวลาไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={resetForm}>
      <Button
        aria-label={`แก้ไขเวลา ${employeeName}`}
        className="size-7 text-slate-400 hover:text-slate-700"
        onClick={() => resetForm(true)}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <Pencil className="size-3.5" />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>แก้ไขเวลา</DialogTitle>
          <DialogDescription>
            {employeeName} · {workDateLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-xs font-medium text-slate-500" htmlFor={`clock-in-${attendanceId}`}>
              เวลาเข้า
            </label>
            <Input
              id={`clock-in-${attendanceId}`}
              onChange={(event) => setClockInTime(event.target.value)}
              type="time"
              value={clockInTime}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-xs font-medium text-slate-500" htmlFor={`clock-out-${attendanceId}`}>
              เวลาออก
            </label>
            <Input
              id={`clock-out-${attendanceId}`}
              onChange={(event) => setClockOutTime(event.target.value)}
              type="time"
              value={clockOutTime}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            ลบเวลาในช่องเพื่อล้างค่า ระบบจะคำนวณชั่วโมงใหม่และบันทึก audit log ทุกครั้ง
          </p>
          {error && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button disabled={saving} onClick={() => setOpen(false)} type="button" variant="outline">
            ยกเลิก
          </Button>
          <Button disabled={saving} onClick={handleSave} type="button">
            บันทึก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
