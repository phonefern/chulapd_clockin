"use client";

import { useEffect, useRef, useState } from "react";
import { Clock3, LocateFixed, MapPin, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CLOCK_OUT_UNDO_WINDOW_MS,
  formatBangkokTime,
  isEarlyClockOut,
  WORK_END_HOUR,
  WORK_END_MINUTE,
} from "@/lib/workSchedule";

type Employee = {
  id: string;
  employee_code: string | null;
  name: string;
  display_name: string | null;
  role: string;
  active: boolean;
};

type Attendance = {
  id: string;
  work_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  total_minutes: number | null;
  status: string;
};

type Geofence = {
  allowed: boolean;
  distanceMeters: number | null;
  location: { id: string; name: string } | null;
};

function formatThaiDate(date: Date) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(date);
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
    });
  });
}

export default function Home() {
  const [status, setStatus] = useState("กำลังเชื่อมต่อ LINE...");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [geofence, setGeofence] = useState<Geofence | null>(null);
  const [locating, setLocating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);
  const [confirmingEarlyClockOut, setConfirmingEarlyClockOut] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const positionRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);

  async function refreshLocation() {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      const { latitude: lat, longitude: lng, accuracy } = pos.coords;
      positionRef.current = { lat, lng, accuracy };

      const res = await fetch("/api/attendance/check-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      const data = await res.json();
      setGeofence(data);
    } catch {
      setGeofence(null);
      positionRef.current = null;
    } finally {
      setLocating(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const idToken = liff.getIDToken();
        if (!idToken) {
          setStatus("ไม่พบ ID token กรุณาเปิดผ่านแอป LINE");
          return;
        }

        setStatus("กำลังตรวจสอบตัวตน...");
        const res = await fetch("/api/auth/line", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });

        const data = await res.json();
        if (!res.ok) {
          setStatus(`เข้าสู่ระบบไม่สำเร็จ: ${data.error}`);
          return;
        }

        setEmployee(data.employee);
        setStatus("");

        const todayRes = await fetch("/api/attendance/today");
        const todayData = await todayRes.json();
        setAttendance(todayData.attendance);

        refreshLocation();
      } catch (err) {
        console.error(err);
        setStatus(
          `เกิดข้อผิดพลาด: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (!attendance?.clock_in_at) return;
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, [attendance]);

  async function handleClockIn() {
    setActionError(null);
    if (!positionRef.current) {
      setActionError("ยังไม่พบตำแหน่งปัจจุบัน กรุณาลองใหม่");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/attendance/clock-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(positionRef.current),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Clock in ไม่สำเร็จ");
        if (data.attendance) setAttendance(data.attendance);
        return;
      }
      setAttendance(data.attendance);
    } catch (err) {
      console.error(err);
      setActionError(
        `เกิดข้อผิดพลาด: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleClockOut() {
    setActionError(null);
    if (!positionRef.current) {
      setActionError("ยังไม่พบตำแหน่งปัจจุบัน กรุณาลองใหม่");
      return;
    }

    if (isEarlyClockOut(new Date())) {
      setConfirmingEarlyClockOut(true);
      return;
    }

    await submitClockOut();
  }

  async function submitClockOut() {
    if (!positionRef.current) {
      setActionError("ยังไม่พบตำแหน่งปัจจุบัน กรุณาลองใหม่");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/attendance/clock-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(positionRef.current),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "Clock out ไม่สำเร็จ");
        if (data.attendance) setAttendance(data.attendance);
        return;
      }
      setAttendance(data.attendance);
      toast.success("Clock out แล้ว");
    } catch (err) {
      console.error(err);
      setActionError(
        `เกิดข้อผิดพลาด: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUndoClockOut() {
    setActionError(null);
    setUndoBusy(true);
    try {
      const res = await fetch("/api/attendance/undo-clock-out", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error ?? "ยกเลิก Clock out ไม่สำเร็จ");
        return;
      }
      setAttendance(data.attendance);
      toast.success("ยกเลิก Clock out แล้ว");
    } catch (err) {
      console.error(err);
      setActionError(
        `เกิดข้อผิดพลาด: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`
      );
    } finally {
      setUndoBusy(false);
    }
  }

  if (!employee) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-sm shadow-sm">
          <CardHeader>
            <BrandMark />
            <CardTitle className="text-xl">ระบบลงเวลาทำงาน</CardTitle>
            <CardDescription>{formatThaiDate(now)}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 rounded-lg border bg-background p-3 text-sm text-muted-foreground">
              <RefreshCw className="size-4 animate-spin text-primary" />
              <span>{status}</span>
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  const clockedIn = !!attendance?.clock_in_at;
  const clockedOut = !!attendance?.clock_out_at;
  const elapsedMs = clockedIn
    ? (clockedOut ? new Date(attendance!.clock_out_at!) : now).getTime() -
      new Date(attendance!.clock_in_at!).getTime()
    : 0;
  const undoMsRemaining =
    clockedOut && attendance?.clock_out_at
      ? new Date(attendance.clock_out_at).getTime() + CLOCK_OUT_UNDO_WINDOW_MS - now.getTime()
      : 0;
  const showUndoClockOut = undoMsRemaining > 0;

  return (
    <main className="flex min-h-screen justify-center bg-muted/30 p-4 sm:p-6">
      <Card className="mt-4 w-full max-w-sm self-start shadow-sm">
        <CardHeader>
          <BrandMark />
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl">
                {employee.display_name ?? employee.name}
              </CardTitle>
              <CardDescription>
                รหัสพนักงาน: {employee.employee_code ?? "ยังไม่กำหนด"}
              </CardDescription>
            </div>
            <Badge variant={clockedOut ? "secondary" : clockedIn ? "outline" : "default"}>
              {clockedOut ? "เสร็จสิ้น" : clockedIn ? "กำลังทำงาน" : "พร้อมลงเวลา"}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          <div className="rounded-lg border bg-background p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">สถานะวันนี้</p>
              <span className="text-xs text-muted-foreground">{formatThaiDate(now)}</span>
            </div>
            <p className="text-2xl font-semibold tracking-tight">
              {!clockedIn && "ยังไม่ได้ลงเวลา"}
              {clockedIn && !clockedOut && `เข้างาน ${formatTime(attendance!.clock_in_at!)} น.`}
              {clockedOut && `ออกงาน ${formatTime(attendance!.clock_out_at!)} น.`}
            </p>
            {clockedIn && (
              <div className="mt-4 flex items-center gap-2 font-mono text-3xl font-semibold tabular-nums">
                <Clock3 className="size-6 text-muted-foreground" />
                <span>{formatDuration(elapsedMs)}</span>
              </div>
            )}
          </div>

          <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
            <span
              className={`mt-1 size-2.5 shrink-0 rounded-full ${geofence?.allowed ? "bg-emerald-500" : "bg-destructive"}`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="size-4 text-muted-foreground" />
                <span>ตำแหน่งปัจจุบัน</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {locating && "กำลังตรวจสอบตำแหน่ง..."}
                {!locating && geofence?.allowed && geofence.location?.name}
                {!locating &&
                  geofence &&
                  !geofence.allowed &&
                  `อยู่นอกพื้นที่ (${geofence.distanceMeters ?? "?"} ม. จาก ${geofence.location?.name ?? "พื้นที่ที่กำหนด"})`}
                {!locating && !geofence && "ไม่พบตำแหน่ง"}
              </p>
            </div>
            <Button
              aria-label="ตรวจสอบตำแหน่งอีกครั้ง"
              disabled={locating}
              onClick={refreshLocation}
              size="icon"
              type="button"
              variant="ghost"
            >
              <LocateFixed className="size-4" />
            </Button>
          </div>

          {actionError && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {actionError}
            </p>
          )}

          {showUndoClockOut && attendance?.clock_out_at && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">
                Clock out แล้วเมื่อ {formatTime(attendance.clock_out_at)} น.
              </p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <span>กดผิดใช่ไหม? เหลือ {Math.ceil(undoMsRemaining / 1000)} วินาที</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleUndoClockOut}
                  disabled={undoBusy}
                >
                  ยกเลิก Clock out
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter>
          {!clockedIn && (
            <Button
              className="h-11 w-full"
              disabled={busy || locating || !geofence?.allowed}
              onClick={handleClockIn}
              type="button"
            >
              Clock in
            </Button>
          )}

          {clockedIn && !clockedOut && (
            <Button
              className="h-11 w-full"
              disabled={busy || locating || !geofence?.allowed}
              onClick={handleClockOut}
              type="button"
              variant="destructive"
            >
              Clock out
            </Button>
          )}

          {clockedOut && (
            <Button className="h-11 w-full" disabled type="button" variant="secondary">
              ลงเวลาวันนี้ครบแล้ว
            </Button>
          )}
        </CardFooter>
      </Card>

      <AlertDialog open={confirmingEarlyClockOut} onOpenChange={setConfirmingEarlyClockOut}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการ Clock out</AlertDialogTitle>
            <AlertDialogDescription>
              ตอนนี้เวลา {formatBangkokTime(new Date())} น. ซึ่งเร็วกว่าเวลาเลิกงานปกติ (
              {String(WORK_END_HOUR).padStart(2, "0")}:{String(WORK_END_MINUTE).padStart(2, "0")} น.)
              ยืนยันว่าต้องการ Clock out ตอนนี้จริงหรือไม่?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                setConfirmingEarlyClockOut(false);
                submitClockOut();
              }}
              disabled={busy}
            >
              Clock out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
