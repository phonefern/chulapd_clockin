// Placeholder A4 sheet while the report is built, so month/employee switches respond immediately.
export default function ReportLoading() {
  return (
    <main className="min-h-screen bg-slate-100 pb-12" aria-busy="true">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-[297mm] items-center gap-3 px-4">
          <div className="h-8 w-16 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-100" />
          <div className="ml-auto h-8 w-40 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </div>
      <div className="mt-10 overflow-x-auto px-4">
        <div className="mx-auto flex h-[210mm] w-[297mm] animate-pulse flex-col gap-[4mm] bg-white px-[11mm] pt-[11mm] shadow-sm">
          <div className="flex justify-between">
            <div className="h-[11mm] w-[90mm] rounded bg-slate-100" />
            <div className="h-[11mm] w-[80mm] rounded bg-slate-100" />
          </div>
          <div className="h-[11mm] rounded bg-slate-50" />
          <div className="h-[13mm] rounded bg-slate-50" />
          <div className="grid flex-1 grid-cols-2 gap-[5mm] pb-[40mm]">
            <div className="rounded bg-slate-50" />
            <div className="rounded bg-slate-50" />
          </div>
        </div>
      </div>
    </main>
  );
}
