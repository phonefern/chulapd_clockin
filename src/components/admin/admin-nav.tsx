"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, FileCheck2, LayoutDashboard, LogOut, Users } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "ภาพรวมวันนี้", icon: LayoutDashboard },
  { href: "/admin/stats", label: "สถิติ", icon: BarChart3 },
  { href: "/admin/employees", label: "พนักงาน", icon: Users },
  { href: "/admin/export", label: "รายงานรับรอง", icon: FileCheck2 },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => null);
    router.replace("/admin/login");
  }

  return (
    <nav className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/admin" className="shrink-0 py-3">
          <BrandMark iconClassName="size-7" />
        </Link>
        <div className="-mb-px flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-4 text-sm font-medium transition-colors",
                  active
                    ? "border-emerald-600 text-slate-950"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                )}
              >
                <Icon className={cn("size-4", active ? "text-emerald-600" : "text-slate-400")} />
                {label}
              </Link>
            );
          })}
        </div>
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <span className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-xs font-semibold text-emerald-700">
            {email.charAt(0).toUpperCase()}
          </span>
          <span className="max-w-44 truncate text-xs text-slate-600">{email}</span>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">ออกจากระบบ</span>
        </button>
      </div>
    </nav>
  );
}
