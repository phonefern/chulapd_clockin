"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatTimestamp(iso: string) {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

export function AutoRefresh({
  isToday,
  updatedAt,
}: {
  isToday: boolean;
  updatedAt: string;
}) {
  const router = useRouter();
  const [lastUpdatedAt, setLastUpdatedAt] = useState(updatedAt);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isToday) return;

    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      setLastUpdatedAt(new Date().toISOString());
    };

    const interval = window.setInterval(refresh, 15000);
    return () => window.clearInterval(interval);
  }, [isToday, router]);

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    setLastUpdatedAt(new Date().toISOString());
    window.setTimeout(() => setRefreshing(false), 500);
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>อัปเดตล่าสุด {formatTimestamp(lastUpdatedAt)}</span>
      <Button
        aria-label="รีเฟรช"
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleRefresh}
        disabled={refreshing}
      >
        <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}
