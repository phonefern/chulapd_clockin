"use client";

import { useState } from "react";
import { ArrowUpDown, BellOff, CalendarOff, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import type { LeavePeriod } from "@/lib/leaves";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export type Employee = {
  id: string;
  employee_code: string | null;
  name: string;
  display_name: string | null;
  line_user_id: string | null;
  role: string;
  active: boolean;
  reminders_enabled: boolean;
  created_at: string;
};

export type EmployeeLeave = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  period: LeavePeriod;
  note: string | null;
  created_by: "admin" | "employee";
  created_at: string;
};

export type TodayAttendance = {
  employee_id: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
};

type EditForm = {
  display_name: string;
  employee_code: string;
  role: string;
  active: boolean;
  reminders_enabled: boolean;
};

type LeaveForm = {
  start_date: string;
  end_date: string;
  period: LeavePeriod;
  note: string;
};

type SortKey = "name" | "employee_code" | "role" | "active";
type SortDir = "asc" | "desc";

function emptyForm(employee: Employee): EditForm {
  return {
    display_name: employee.display_name ?? "",
    employee_code: employee.employee_code ?? "",
    role: employee.role,
    active: employee.active,
    reminders_enabled: employee.reminders_enabled,
  };
}

const LEAVE_PERIOD_LABEL: Record<LeavePeriod, string> = {
  full: "ทั้งวัน",
  morning: "ครึ่งเช้า",
  afternoon: "ครึ่งบ่าย",
};

function emptyLeaveForm(today: string): LeaveForm {
  return { start_date: today, end_date: today, period: "full", note: "" };
}

function formatLeaveDate(date: string) {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${date}T00:00:00+07:00`));
}

function formatLeaveRange(leave: EmployeeLeave) {
  const range =
    leave.start_date === leave.end_date
      ? formatLeaveDate(leave.start_date)
      : `${formatLeaveDate(leave.start_date)} – ${formatLeaveDate(leave.end_date)}`;
  return `${range} (${LEAVE_PERIOD_LABEL[leave.period]})`;
}

function displayName(employee: Employee) {
  return employee.display_name ?? employee.name;
}

function formatTime(iso: string) {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

function todayStatus(row: TodayAttendance | undefined) {
  if (!row?.clock_in_at) {
    return { label: "ยังไม่ลงเวลา", variant: "secondary" as const };
  }
  if (row.clock_out_at) {
    return { label: `Clocked out ${formatTime(row.clock_out_at)}`, variant: "secondary" as const };
  }
  return { label: `Clocked in ${formatTime(row.clock_in_at)}`, variant: "outline" as const };
}

function compareEmployees(a: Employee, b: Employee, key: SortKey, dir: SortDir) {
  let result = 0;

  if (key === "active") {
    result = a.active === b.active ? 0 : a.active ? -1 : 1;
  } else {
    const left =
      key === "name" ? displayName(a) : key === "employee_code" ? a.employee_code ?? "" : a.role;
    const right =
      key === "name" ? displayName(b) : key === "employee_code" ? b.employee_code ?? "" : b.role;
    result = left.localeCompare(right, "th", { numeric: true, sensitivity: "base" });
  }

  return dir === "asc" ? result : -result;
}

function SortButton({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === activeKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-950"
    >
      {label}
      <ArrowUpDown className={`size-3.5 ${active ? "text-slate-950" : "text-slate-400"}`} />
      {active && <span className="sr-only">{direction === "asc" ? "ascending" : "descending"}</span>}
    </button>
  );
}

export function EmployeesTable({
  initialEmployees,
  todayStatusByEmployee,
  initialLeavesByEmployee,
  today,
}: {
  initialEmployees: Employee[];
  todayStatusByEmployee: Record<string, TodayAttendance>;
  initialLeavesByEmployee: Record<string, EmployeeLeave[]>;
  today: string;
}) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);
  const [hasHistory, setHasHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leavesByEmployee, setLeavesByEmployee] = useState(initialLeavesByEmployee);
  const [leaveEmployee, setLeaveEmployee] = useState<Employee | null>(null);
  const [leaveForm, setLeaveForm] = useState<LeaveForm>(() => emptyLeaveForm(today));

  function openEdit(employee: Employee) {
    setEditing(employee);
    setForm(emptyForm(employee));
  }

  function handleSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDir("asc");
  }

  async function handleSave() {
    if (!editing || !form) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/employees/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: form.display_name.trim() === "" ? null : form.display_name.trim(),
          employee_code: form.employee_code,
          role: form.role,
          active: form.active,
          reminders_enabled: form.reminders_enabled,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setEmployees((prev) =>
        prev.map((e) => (e.id === data.employee.id ? data.employee : e))
      );
      toast.success("บันทึกข้อมูลแล้ว");
      setEditing(null);
      setForm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(force = false) {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/employees/${deleting.id}${force ? "?force=true" : ""}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        if (data.hasHistory && !force) {
          setHasHistory(true);
          return;
        }
        toast.error(data.error ?? "ลบไม่สำเร็จ");
        return;
      }
      setEmployees((prev) => prev.filter((e) => e.id !== deleting.id));
      toast.success(force ? "ลบพนักงานพร้อมประวัติแล้ว" : "ลบพนักงานแล้ว");
      setDeleting(null);
      setHasHistory(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function openLeaves(employee: Employee) {
    setLeaveEmployee(employee);
    setLeaveForm(emptyLeaveForm(today));
  }

  async function handleAddLeave() {
    if (!leaveEmployee) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: leaveEmployee.id, ...leaveForm }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "บันทึกวันลาไม่สำเร็จ");
        return;
      }
      const leave = data.leave as EmployeeLeave;
      setLeavesByEmployee((prev) => ({
        ...prev,
        [leave.employee_id]: [...(prev[leave.employee_id] ?? []), leave].sort((a, b) =>
          a.start_date.localeCompare(b.start_date)
        ),
      }));
      setLeaveForm(emptyLeaveForm(today));
      toast.success("บันทึกวันลาแล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLeave(leave: EmployeeLeave) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/leaves/${leave.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "ลบวันลาไม่สำเร็จ");
        return;
      }
      setLeavesByEmployee((prev) => ({
        ...prev,
        [leave.employee_id]: (prev[leave.employee_id] ?? []).filter((l) => l.id !== leave.id),
      }));
      toast.success("ลบวันลาแล้ว");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const query = search.trim().toLowerCase();
  const visibleEmployees = employees
    .filter((employee) => {
      if (!query) return true;
      return [employee.name, employee.display_name, employee.employee_code]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    })
    .sort((a, b) => compareEmployees(a, b, sortKey, sortDir));

  const activeCount = employees.filter((employee) => employee.active).length;
  const adminCount = employees.filter((employee) => employee.role === "admin").length;

  return (
    <>
      <section className="mb-7 grid gap-3 sm:grid-cols-3" aria-label="สรุปพนักงาน">
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">พนักงานทั้งหมด</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{employees.length}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">ใช้งาน</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{activeCount}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs text-slate-500">ผู้ดูแลระบบ</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">{adminCount}</p>
          </CardContent>
        </Card>
      </section>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <CardTitle className="text-base">รายชื่อพนักงาน</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                แสดง {visibleEmployees.length} จาก {employees.length} คน
              </p>
            </div>
            <div className="relative w-full md:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="ค้นหาชื่อ/รหัสพนักงาน"
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-5 sm:px-6">
                <SortButton label="ชื่อ (LINE)" sortKey="name" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>ชื่อทางการ</TableHead>
              <TableHead>
                <SortButton label="รหัสพนักงาน" sortKey="employee_code" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortButton label="สิทธิ์" sortKey="role" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>
                <SortButton label="สถานะ" sortKey="active" activeKey={sortKey} direction={sortDir} onSort={handleSort} />
              </TableHead>
              <TableHead>วันนี้</TableHead>
              <TableHead className="px-5 text-right sm:px-6">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleEmployees.map((employee) => {
              const status = todayStatus(todayStatusByEmployee[employee.id]);
              const leaveToday = (leavesByEmployee[employee.id] ?? []).find(
                (leave) => leave.start_date <= today && leave.end_date >= today
              );
              return (
                <TableRow key={employee.id}>
                  <TableCell className="px-5 sm:px-6">{employee.name}</TableCell>
                  <TableCell>{employee.display_name ?? "-"}</TableCell>
                  <TableCell>{employee.employee_code ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={employee.role === "admin" ? "default" : "secondary"}>
                      {employee.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={employee.active ? "default" : "destructive"}>
                        {employee.active ? "ใช้งาน" : "ปิดใช้งาน"}
                      </Badge>
                      {!employee.reminders_enabled && (
                        <Badge variant="outline" className="gap-1 text-slate-500">
                          <BellOff className="size-3" />
                          ปิดแจ้งเตือน
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {leaveToday && (
                        <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-800">
                          <CalendarOff className="size-3" />
                          ลา{LEAVE_PERIOD_LABEL[leaveToday.period]}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-5 text-right sm:px-6">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(employee)}>
                        แก้ไข
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openLeaves(employee)}>
                        วันลา
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          setDeleting(employee);
                          setHasHistory(false);
                        }}
                      >
                        ลบ
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {visibleEmployees.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  ไม่พบพนักงานที่ตรงกับคำค้น
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
            setForm(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>แก้ไขข้อมูลพนักงาน</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="display_name">ชื่อทางการ</Label>
                <Input
                  id="display_name"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  placeholder={editing?.name}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="employee_code">รหัสพนักงาน</Label>
                <Input
                  id="employee_code"
                  value={form.employee_code}
                  onChange={(e) => setForm({ ...form, employee_code: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>สิทธิ์</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) => setForm({ ...form, role: value as string })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">employee</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="active">เปิดใช้งานบัญชี</Label>
                <Switch
                  id="active"
                  checked={form.active}
                  onCheckedChange={(checked) => setForm({ ...form, active: !!checked })}
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="reminders_enabled">รับแจ้งเตือนผ่าน LINE</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ปิดสำหรับคนที่ไม่ได้ใช้ระบบลงเวลา เพื่อประหยัดโควตาข้อความ LINE
                  </p>
                </div>
                <Switch
                  id="reminders_enabled"
                  checked={form.reminders_enabled}
                  onCheckedChange={(checked) => setForm({ ...form, reminders_enabled: !!checked })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              ยกเลิก
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!leaveEmployee}
        onOpenChange={(open) => {
          if (!open) setLeaveEmployee(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              วันลา · {leaveEmployee ? displayName(leaveEmployee) : ""}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            วันที่ลาจะไม่ถูกส่งแจ้งเตือนทาง LINE — ลาครึ่งเช้าข้ามเฉพาะรอบ 08:20
            ลาครึ่งบ่ายข้ามเฉพาะรอบ 16:20
          </p>
          {leaveEmployee && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <p className="text-sm font-medium">วันลาที่กำลังจะถึง</p>
                {(leavesByEmployee[leaveEmployee.id] ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">ยังไม่มีวันลา</p>
                ) : (
                  <ul className="grid gap-1.5">
                    {(leavesByEmployee[leaveEmployee.id] ?? []).map((leave) => (
                      <li
                        key={leave.id}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                      >
                        <div>
                          <p>{formatLeaveRange(leave)}</p>
                          {(leave.note || leave.created_by === "employee") && (
                            <p className="text-xs text-muted-foreground">
                              {[leave.note, leave.created_by === "employee" ? "พนักงานแจ้งเองผ่าน LINE" : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label="ลบวันลา"
                          onClick={() => handleDeleteLeave(leave)}
                          disabled={saving}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="grid gap-3 border-t pt-4">
                <p className="text-sm font-medium">เพิ่มวันลา</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="leave_start">ตั้งแต่</Label>
                    <Input
                      id="leave_start"
                      type="date"
                      value={leaveForm.start_date}
                      onChange={(e) => {
                        const start = e.target.value;
                        setLeaveForm((prev) => ({
                          ...prev,
                          start_date: start,
                          end_date: prev.end_date < start ? start : prev.end_date,
                        }));
                      }}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="leave_end">ถึง</Label>
                    <Input
                      id="leave_end"
                      type="date"
                      min={leaveForm.start_date}
                      value={leaveForm.end_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>ช่วงเวลา</Label>
                  <Select
                    value={leaveForm.period}
                    onValueChange={(value) =>
                      setLeaveForm({ ...leaveForm, period: value as LeavePeriod })
                    }
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
                  <Label htmlFor="leave_note">หมายเหตุ (ไม่บังคับ)</Label>
                  <Input
                    id="leave_note"
                    value={leaveForm.note}
                    onChange={(e) => setLeaveForm({ ...leaveForm, note: e.target.value })}
                    placeholder="เช่น ลาพักร้อน, ลาป่วย"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveEmployee(null)}>
              ปิด
            </Button>
            <Button onClick={handleAddLeave} disabled={saving || !leaveForm.start_date}>
              {saving ? "กำลังบันทึก..." : "เพิ่มวันลา"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setHasHistory(false);
          }
        }}
      >
        <AlertDialogContent>
          {!hasHistory ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>ลบพนักงาน {deleting?.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  การลบไม่สามารถย้อนกลับได้ ถ้ามีประวัติการลงเวลาผูกอยู่ ระบบจะไม่ให้ลบทันที
                  และจะถามให้ยืนยันอีกครั้ง
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={() => handleDelete(false)}
                  disabled={saving}
                >
                  ลบ
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {deleting?.name} มีประวัติการลงเวลาผูกอยู่
                </AlertDialogTitle>
                <AlertDialogDescription>
                  ถ้าลบต่อ ระบบจะลบประวัติการลงเวลาและคำขอแก้ไขเวลาของพนักงานคนนี้ทั้งหมดไปด้วย
                  การกระทำนี้ย้อนกลับไม่ได้ แนะนำให้ปิดใช้งาน (active) แทนถ้ายังต้องการเก็บประวัติไว้
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setHasHistory(false)}>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-white hover:bg-destructive/90"
                  onClick={() => handleDelete(true)}
                  disabled={saving}
                >
                  ลบพร้อมประวัติทั้งหมด
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
