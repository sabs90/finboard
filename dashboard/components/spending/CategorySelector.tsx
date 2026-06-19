'use client';

import { useRouter } from 'next/navigation';

interface ParentOption {
  id: number;
  name: string;
  colour: string;
}

interface ChildOption {
  id: number;
  name: string;
  parent_id: number;
  parent_name: string;
}

export function CategorySelector({
  parents,
  children,
  selectedParentId,
  selectedChildId,
}: {
  parents: ParentOption[];
  children: ChildOption[];
  selectedParentId: number | null;
  selectedChildId: number | null;
}) {
  const router = useRouter();

  function handleParentChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (id) {
      router.push(`/deep-dive?parent=${id}`);
    } else {
      router.push('/deep-dive');
    }
  }

  function handleChildChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    if (id && selectedParentId) {
      router.push(`/deep-dive?parent=${selectedParentId}&sub=${id}`);
    } else if (selectedParentId) {
      router.push(`/deep-dive?parent=${selectedParentId}`);
    }
  }

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div>
        <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wide font-semibold">
          Category
        </label>
        <select
          value={selectedParentId ?? ''}
          onChange={handleParentChange}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 min-w-[180px]"
        >
          <option value="">Select a category...</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {selectedParentId && children.length > 0 && (
        <div>
          <label className="block text-xs text-slate-400 mb-1 uppercase tracking-wide font-semibold">
            Subcategory
          </label>
          <select
            value={selectedChildId ?? ''}
            onChange={handleChildChange}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 min-w-[180px]"
          >
            <option value="">All subcategories</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {(selectedParentId || selectedChildId) && (
        <div className="self-end">
          <button
            onClick={() => {
              const parts = [
                ...(selectedParentId ? [`parent=${selectedParentId}`] : []),
                ...(selectedChildId ? [`sub=${selectedChildId}`] : []),
              ];
              router.push(`/deep-dive${parts.length ? `?${parts.join('&')}` : ''}`);
            }}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            View Deep Dive &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
