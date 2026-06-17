'use client';

import { useState, useTransition, useEffect } from 'react';
import { addCategoryRule, removeCategoryRule, previewRuleMatches } from '@/lib/actions';
import type { CategoryRuleRow, CategoryRow, RuleType } from '@/lib/db';

function CategorySelect({
  categories, value, onChange,
}: { categories: CategoryRow[]; value: number | ''; onChange: (v: number | '') => void }) {
  const grouped = new Map<string, CategoryRow[]>();
  for (const cat of categories) {
    const parent = cat.parent_name || 'Other';
    if (!grouped.has(parent)) grouped.set(parent, []);
    grouped.get(parent)!.push(cat);
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : '')}
      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
    >
      <option value="">Select category…</option>
      {Array.from(grouped.entries()).map(([parent, children]) => (
        <optgroup key={parent} label={parent}>
          {children.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export function RuleManager({ rules, categories }: { rules: CategoryRuleRow[]; categories: CategoryRow[] }) {
  const [ruleType, setRuleType] = useState<RuleType>('description');
  const [pattern, setPattern] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Debounced live preview of how many transactions the pattern matches.
  useEffect(() => {
    const p = pattern.trim();
    if (!p) { setMatchCount(null); return; }
    const t = setTimeout(async () => {
      setMatchCount(await previewRuleMatches(ruleType, p));
    }, 300);
    return () => clearTimeout(t);
  }, [pattern, ruleType]);

  function submit() {
    if (!pattern.trim() || categoryId === '') return;
    startTransition(async () => {
      const { affected } = await addCategoryRule(ruleType, pattern, categoryId as number);
      setResult(`Rule saved — updated ${affected} transaction${affected === 1 ? '' : 's'}.`);
      setPattern('');
      setCategoryId('');
      setMatchCount(null);
    });
  }

  const merchantRules = rules.filter((r) => r.rule_type === 'merchant');
  const descriptionRules = rules.filter((r) => r.rule_type === 'description');

  return (
    <div className="space-y-6">
      {/* Create rule */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Create a rule</h2>
        <p className="text-sm text-slate-500">
          A rule auto-categorises matching transactions — applied now to all existing matches and to
          future imports. For a one-off change, edit the category inline on the Transactions page instead.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Match by</label>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as RuleType)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
            >
              <option value="description">Keyword in description</option>
              <option value="merchant">Exact merchant</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <label className="text-xs text-slate-500">
              {ruleType === 'description' ? 'Keyword' : 'Merchant name'}
            </label>
            <input
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={ruleType === 'description' ? 'e.g. uber' : 'e.g. Woolworths'}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Category</label>
            <CategorySelect categories={categories} value={categoryId} onChange={setCategoryId} />
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={isPending || !pattern.trim() || categoryId === ''}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
          >
            {isPending ? 'Applying…' : 'Create & apply'}
          </button>
        </div>

        <div className="text-sm min-h-[20px]">
          {result ? (
            <span className="text-emerald-400">{result}</span>
          ) : matchCount !== null ? (
            <span className="text-slate-400">
              Matches <span className="text-slate-200 font-medium tabular-nums">{matchCount}</span> existing
              transaction{matchCount === 1 ? '' : 's'}.
            </span>
          ) : null}
        </div>
      </div>

      {/* Existing rules */}
      {[{ label: 'Keyword rules', list: descriptionRules }, { label: 'Merchant rules', list: merchantRules }].map(
        ({ label, list }) => (
          <div key={label} className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">{label}</h2>
              <span className="text-xs text-slate-500">{list.length}</span>
            </div>
            {list.length > 0 ? (
              <div className="divide-y divide-slate-800/50 max-h-[420px] overflow-y-auto">
                {list.map((r) => (
                  <RuleRow key={r.id} rule={r} />
                ))}
              </div>
            ) : (
              <div className="p-6 text-sm text-slate-500">No {label.toLowerCase()} yet.</div>
            )}
          </div>
        ),
      )}
    </div>
  );
}

function RuleRow({ rule }: { rule: CategoryRuleRow }) {
  const [isPending, startTransition] = useTransition();
  const [removed, setRemoved] = useState(false);
  if (removed) return null;

  return (
    <div className="flex items-center justify-between px-6 py-2.5 hover:bg-slate-800/30">
      <div className="flex items-center gap-3 min-w-0">
        <code className="text-sm text-slate-200 truncate">{rule.pattern}</code>
        <span className="text-slate-600">→</span>
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: rule.colour }} />
          {rule.parent_category ? `${rule.parent_category} › ${rule.category}` : rule.category}
        </span>
        {rule.is_transfer === 1 && (
          <span className="text-[10px] uppercase tracking-wide text-slate-500 border border-slate-700 rounded px-1.5 py-0.5">transfer</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => startTransition(async () => { await removeCategoryRule(rule.id); setRemoved(true); })}
        disabled={isPending}
        aria-label="Delete rule"
        className="text-slate-600 hover:text-rose-400 transition-colors text-sm px-2"
      >
        ✕
      </button>
    </div>
  );
}
