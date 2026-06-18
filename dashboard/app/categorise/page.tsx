import { getCategorisationCandidates, getCategoryTree } from '@/lib/db';
import { CategoriseGrid } from '@/components/categorise/CategoriseGrid';

const LIMIT = 200;

export default function CategorisePage({
  searchParams,
}: {
  searchParams: { q?: string; scope?: string };
}) {
  const query = searchParams.q?.trim() || undefined;
  const scope = searchParams.scope || 'uncategorised';
  const categoryTree = getCategoryTree();

  const rows = getCategorisationCandidates({ scope, query, limit: LIMIT });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-100">Bulk Categorise</h1>
        <span className="text-sm text-slate-400">
          {rows.length}{rows.length === LIMIT ? '+' : ''} transaction{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      <p className="text-sm text-slate-500">
        Pick a new parent/child category for any row. Add a keyword to turn it into a reusable rule
        applied across all matching transactions; leave the keyword blank for a one-off change. Click
        Apply once to commit everything.
      </p>

      {/* Filter toolbar (native GET form) */}
      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
          <label className="text-xs text-slate-500">Search description / merchant</label>
          <input
            type="text"
            name="q"
            defaultValue={query ?? ''}
            placeholder="Search…"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Scope</label>
          <select
            name="scope"
            defaultValue={scope}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 max-w-[260px]"
          >
            <optgroup label="Filters">
              <option value="uncategorised">Uncategorised only</option>
              <option value="transfers">Money Transfers</option>
              <option value="all">All transactions</option>
            </optgroup>
            {categoryTree.map((p) => (
              <optgroup key={p.id} label={p.name}>
                <option value={`cat:${p.id}`}>{p.name} (all)</option>
                {p.children.map((c) => (
                  <option key={c.id} value={`cat:${c.id}`}>&nbsp;&nbsp;{c.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-sm font-medium text-slate-100 transition-colors"
        >
          Apply filter
        </button>
      </form>

      {rows.length > 0 ? (
        <CategoriseGrid rows={rows} categoryTree={categoryTree} />
      ) : (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center text-slate-500 text-sm">
          {scope === 'uncategorised' ? 'Nothing left to categorise here. 🎉' : 'No transactions match your filter.'}
        </div>
      )}
    </div>
  );
}
