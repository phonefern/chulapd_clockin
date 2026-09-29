"use client";

import { useState } from "react";
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

export type RemoteClockOutQuota = {
  month: string;
  limit: number;
  used: number;
  remaining: number;
};

export type RemoteClockOutTarget = {
  id: string;
  work_date: string;
  clock_in_at: string;
};

type Attendance = {
  id: string;
  work_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  total_minutes: number | null;
  status: string;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${date}T00:00:00+07:00`));
}

function formatHm(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(date);
}

export function RemoteClockOutDialog({
  target,
  isToday,
  defaultTime,
  quota,
  getPosition,
  onClose,
  onDone,
}: {
  target: RemoteClockOutTarget | null;
  isToday: boolean;
  defaultTime: string;
  quota: RemoteClockOutQuota | null;
  getPosition: () => { lat: number; lng: number; accuracy: number } | null;
  onClose: () => void;
  onDone: (attendance: Attendance, quota: RemoteClockOutQuota) => void;
}) {
  const [time, setTime] = useState(defaultTime);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const noQuota = !!quota && quota.remaining <= 0;

  async function handleSubmit() {
    if (!target) return;
    setSaving(true);
    try {
      const res = await fetch("/api/attendance/remote-clock-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId: target.id, time, note, ...getPosition() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "ลงเวลาออกไม่สำเร็จ");
        return;
      }
      toast.success(`ลงเวลาออก ${time} น. แล้ว`);
      onDone(data.attendance, data.quota);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ลงเวลาออกนอกพื้นที่</DialogTitle>
          <DialogDescription>
            {target &&
              `${isToday ? "วันนี้" : formatDate(target.work_date)} · เข้างาน ${formatHm(new Date(target.clock_in_at))} น.`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="remote_clock_out_time">เวลาที่ออกจากที่ทำงานจริง</Label>
            <Input
              id="remote_clock_out_time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="remote_clock_out_note">เหตุผล (ไม่บังคับ)</Label>
            <Input
              id="remote_clock_out_note"
              maxLength={200}
              placeholder="เช่น ลืมกด Clock out ก่อนกลับ"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {quota && (
            <p
              className={`rounded-lg border p-3 text-sm ${noQuota ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-amber-200 bg-amber-50 text-amber-900"}`}
            >
              {noQuota
                ? `ใช้สิทธิ์ครบ ${quota.limit} ครั้งของเดือนนี้แล้ว กรุณาติดต่อผู้ดูแลระบบเพื่อแก้ไขเวลา`
                : `ใช้สิทธิ์ได้อีก ${quota.remaining} จาก ${quota.limit} ครั้งในเดือนนี้ ผู้ดูแลระบบจะเห็นว่าเป็นการลงเวลานอกพื้นที่`}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} type="button">
            ยกเลิก
          </Button>
          <Button
            disabled={saving || noQuota || !time}
            onClick={handleSubmit}
            type="button"
            variant="destructive"
          >
            {saving ? "กำลังบันทึก..." : "ยืนยันเวลาออก"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
