import { AdminNav } from "@/components/admin/admin-nav";
import { getAdminSession } from "@/lib/requireAdminSession";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await getAdminSession();

  return (
    <>
      {session && <AdminNav email={session.email} />}
      {children}
    </>
  );
}
