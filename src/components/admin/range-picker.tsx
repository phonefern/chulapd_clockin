"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { addWorkDays } from "@/lib/workDate";

export function RangePicker({
  from,
  to,
  today,
}: {
  from: string;
  to: string;
  today: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(nextFrom: string, nextTo: string, preset: "7d" | "30d" | "custom") {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", nextFrom);
    params.set("to", nextTo);
    params.set("range", preset);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={from === addWorkDays(today, -6) && to === today ? "default" : "outline"}
        onClick={() => navigate(addWorkDays(today, -6), today, "7d")}
      >
        7 วัน
      </Button>
      <Button
        type="button"
        variant={from === addWorkDays(today, -29) && to === today ? "default" : "outline"}
        onClick={() => navigate(addWorkDays(today, -29), today, "30d")}
      >
        30 วัน
      </Button>
      <input
        type="date"
        value={from}
        onChange={(event) => navigate(event.target.value, to, "custom")}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <span className="text-sm text-muted-foreground">ถึง</span>
      <input
        type="date"
        value={to}
        onChange={(event) => navigate(from, event.target.value, "custom")}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
    </div>
  );
}
