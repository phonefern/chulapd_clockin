"use client";

import { useEffect, useState } from "react";
import { Download, FileCheck2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type MyReport = {
  id: string;
  month: string;
  verificationId: string;
  approverName: string;
  approvedAt: string;
  version: number;
  pdfUrl: string;
};

function formatMonth(month: string) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${month}-01T00:00:00+07:00`));
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(iso));
}

// PDFs open in the phone's own browser: LINE's in-app browser can't reliably show/save PDFs.
async function openPdf(url: string) {
  try {
    const liff = (await import("@line/liff")).default;
    if (liff.isInClient()) {
      liff.openWindow({ url, external: true });
      return;
    }
  } catch {
    // Not inside LINE (or LIFF not initialised) — fall back to a normal tab.
  }
  window.open(url, "_blank", "noopener");
}

export function MyReportsPanel() {
  const [reports, setReports] = useState<MyReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/attendance/my-reports", { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "โหลดรายงานไม่สำเร็จ");
        setReports(data.reports as MyReport[]);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "โหลดรายงานไม่สำเร็จ");
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <FileCheck2 className="size-4 text-muted-foreground" />
        รายงานรับรองเวลาปฏิบัติงาน
      </div>
      {error && (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
      )}
      {!error && reports === null && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="size-4 animate-spin" />
          กำลังโหลด...
        </div>
      )}
      {reports && reports.length === 0 && (
        <p className="text-sm text-muted-foreground">ยังไม่มีรายงานที่ได้รับการรับรอง</p>
      )}
      {reports && reports.length > 0 && (
        <ul className="grid gap-2">
          {reports.map((report) => (
            <li key={report.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium">{formatMonth(report.month)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  รับรองโดย {report.approverName} · {formatDate(report.approvedAt)}
                </p>
              </div>
              <Button className="shrink-0 gap-1.5" onClick={() => openPdf(report.pdfUrl)} size="sm" type="button" variant="outline">
                <Download className="size-4" />
                PDF
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
