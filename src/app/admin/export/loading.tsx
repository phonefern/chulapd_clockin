// Shown instantly while the month's reports are computed (e.g. after switching months).
export default function ExportLoading() {
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-8 sm:px-6 lg:px-8" aria-busy="true">
      <div className="mx-auto max-w-7xl animate-pulse">
        <div className="mb-8">
          <div className="h-3 w-40 rounded bg-slate-200" />
          <div className="mt-3 h-9 w-96 max-w-full rounded-lg bg-slate-200" />
          <div className="mt-4 h-8 w-56 rounded-lg bg-slate-200" />
        </div>
        <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[82px] rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-6 py-5">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-72 rounded bg-slate-100" />
          </div>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-6 border-b border-slate-100 px-6 py-4 last:border-b-0">
              <div className="h-4 w-48 rounded bg-slate-200" />
              <div className="ml-auto h-4 w-64 rounded bg-slate-100" />
              <div className="h-8 w-36 rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
