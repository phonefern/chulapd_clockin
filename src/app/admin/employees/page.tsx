import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/requireAdminSession";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { EmployeesTable, type Employee } from "@/components/admin/employees-table";

export default async function AdminEmployeesPage() {
  const session = await getAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("employees")
    .select("id, employee_code, name, display_name, line_user_id, role, active, created_at")
    .order("created_at", { ascending: true });

  const employees = (data ?? []) as Employee[];

  return (
    <main className="mx-auto max-w-5xl p-6 sm:p-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">พนักงาน</h1>
          <p className="text-sm text-muted-foreground">
            แก้ไขชื่อทางการ รหัสพนักงาน สิทธิ์ และสถานะการใช้งาน
          </p>
        </div>
        <a href="/admin" className="text-sm text-muted-foreground underline">
          ← Attendance วันนี้
        </a>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error.message}</p>}

      <div className="rounded-xl border">
        <EmployeesTable initialEmployees={employees} />
      </div>
    </main>
  );
}
