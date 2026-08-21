"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addWorkDays } from "@/lib/workDate";

export function DateNav({
  date,
  today,
}: {
  date: string;
  today: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(nextDate: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextDate === today) {
      params.delete("date");
    } else {
      params.set("date", nextDate);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        aria-label="วันก่อนหน้า"
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={() => navigate(addWorkDays(date, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <input
        type="date"
        value={date}
        onChange={(event) => navigate(event.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Button
        aria-label="วันถัดไป"
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={() => navigate(addWorkDays(date, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
      <Button type="button" variant="secondary" onClick={() => navigate(today)}>
        วันนี้
      </Button>
    </div>
  );
}
