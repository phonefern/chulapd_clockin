"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  created_at: string;
};

type EditForm = {
  display_name: string;
  employee_code: string;
  role: string;
  active: boolean;
};

function emptyForm(employee: Employee): EditForm {
  return {
    display_name: employee.display_name ?? "",
    employee_code: employee.employee_code ?? "",
    role: employee.role,
    active: employee.active,
  };
}

export function EmployeesTable({ initialEmployees }: { initialEmployees: Employee[] }) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);
  const [hasHistory, setHasHistory] = useState(false);
  const [saving, setSaving] = useState(false);

  function openEdit(employee: Employee) {
    setEditing(employee);
    setForm(emptyForm(employee));
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

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ชื่อ (LINE)</TableHead>
            <TableHead>ชื่อทางการ</TableHead>
            <TableHead>รหัสพนักงาน</TableHead>
            <TableHead>สิทธิ์</TableHead>
            <TableHead>สถานะ</TableHead>
            <TableHead className="text-right">จัดการ</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => (
            <TableRow key={employee.id}>
              <TableCell>{employee.name}</TableCell>
              <TableCell>{employee.display_name ?? "-"}</TableCell>
              <TableCell>{employee.employee_code ?? "-"}</TableCell>
              <TableCell>
                <Badge variant={employee.role === "admin" ? "default" : "secondary"}>
                  {employee.role}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={employee.active ? "default" : "destructive"}>
                  {employee.active ? "ใช้งาน" : "ปิดใช้งาน"}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(employee)}>
                    แก้ไข
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
          ))}
          {employees.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                ยังไม่มีพนักงานในระบบ
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

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
