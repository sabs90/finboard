/**
 * Generic loading skeleton: a title bar, an optional KPI row and a few card
 * placeholders. Used as the Suspense fallback (loading.tsx) for data routes.
 */
export function PageSkeleton({ kpis = 4, cards = 2 }: { kpis?: number; cards?: number }) {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-40 rounded bg-slate-800" />
        <div className="h-5 w-24 rounded bg-slate-800" />
      </div>

      {kpis > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: kpis }).map((_, i) => (
            <div key={i} className="h-24 rounded-2xl border border-slate-800 bg-slate-900" />
          ))}
        </div>
      )}

      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="h-64 rounded-2xl border border-slate-800 bg-slate-900" />
      ))}
    </div>
  );
}
