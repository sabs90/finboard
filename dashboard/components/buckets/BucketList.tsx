'use client';

import { useState, useTransition } from 'react';
import type { BucketWithBalance, ParentCategoryRow } from '@/lib/db';
import { formatCurrency, formatDate, formatDollars } from '@/lib/formatters';
import { createBucketAction, updateBucketAction, archiveBucketAction, adjustBucketAction, type BucketInput } from '@/app/buckets/actions';

interface Props {
  buckets: BucketWithBalance[];
  parentCategories: ParentCategoryRow[];
}

const inputClass =
  'bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 ' +
  'placeholder:text-slate-500 focus:outline-none focus:border-slate-500 w-full tabular-nums';

function parseDollars(s: string): number {
  const n = parseFloat(s.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Months until target at the current accrual pace (ignoring future spend). */
function monthsToTarget(b: BucketWithBalance): number | null {
  if (b.target_cents === null || b.monthly_accrual_cents <= 0) return null;
  const gap = b.target_cents - b.balanceCents;
  if (gap <= 0) return 0;
  return Math.ceil(gap / b.monthly_accrual_cents);
}

function targetDateLabel(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${names[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Edit / create form ────────────────────────────────────────────────────────

interface FormState {
  name: string;
  perMonth: string;
  perYear: string;
  target: string;
  opening: string;
  linked: number[];
}

function BucketForm({
  initial,
  parentCategories,
  showOpening,
  onSave,
  onCancel,
  pending,
}: {
  initial: FormState;
  parentCategories: ParentCategoryRow[];
  showOpening: boolean;
  onSave: (input: BucketInput & { openingBalanceDollars: number }) => void;
  onCancel: () => void;
  pending: boolean;
}) {
  const [form, setForm] = useState(initial);

  const setMonthly = (v: string) => {
    const d = parseDollars(v);
    setForm((f) => ({ ...f, perMonth: v, perYear: d > 0 ? String(Math.round(d * 12)) : '' }));
  };
  const setYearly = (v: string) => {
    const d = parseDollars(v);
    setForm((f) => ({ ...f, perYear: v, perMonth: d > 0 ? (d / 12).toFixed(2) : '' }));
  };
  const toggleLinked = (id: number) =>
    setForm((f) => ({
      ...f,
      linked: f.linked.includes(id) ? f.linked.filter((x) => x !== id) : [...f.linked, id],
    }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Name</label>
          <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Holiday" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Target $ (optional)</label>
          <input type="text" inputMode="decimal" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))} placeholder="e.g. 30000" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Accrue $ / month</label>
          <input type="text" inputMode="decimal" value={form.perMonth} onChange={(e) => setMonthly(e.target.value)} placeholder="e.g. 500" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">= $ / year</label>
          <input type="text" inputMode="decimal" value={form.perYear} onChange={(e) => setYearly(e.target.value)} placeholder="e.g. 6000" className={inputClass} />
        </div>
        {showOpening && (
          <div>
            <label className="block text-xs text-slate-500 mb-1">Opening balance $ (optional)</label>
            <input type="text" inputMode="decimal" value={form.opening} onChange={(e) => setForm((f) => ({ ...f, opening: e.target.value }))} placeholder="0" className={inputClass} />
          </div>
        )}
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-1.5">Spending in these categories deducts from the bucket:</p>
        <div className="flex flex-wrap gap-1.5">
          {parentCategories.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggleLinked(p.id)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                form.linked.includes(p.id)
                  ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                  : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={pending || !form.name.trim()}
          onClick={() =>
            onSave({
              name: form.name,
              monthlyAccrualDollars: parseDollars(form.perMonth),
              targetDollars: parseDollars(form.target) > 0 ? parseDollars(form.target) : null,
              linkedParentIds: form.linked,
              openingBalanceDollars: parseDollars(form.opening),
            })
          }
          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          Save
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-slate-700 text-sm text-slate-300 hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Bucket card ───────────────────────────────────────────────────────────────

function BucketCard({ bucket, parentCategories }: { bucket: BucketWithBalance; parentCategories: ParentCategoryRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  const pct = bucket.target_cents !== null && bucket.target_cents > 0
    ? Math.max(0, Math.min(100, Math.round((bucket.balanceCents / bucket.target_cents) * 100)))
    : null;
  const toTarget = monthsToTarget(bucket);
  const negative = bucket.balanceCents < 0;

  const adjust = (sign: 1 | -1) => {
    const d = parseDollars(adjustAmount);
    if (d <= 0) return;
    startTransition(async () => {
      await adjustBucketAction(bucket.id, sign * d, adjustNote);
      setAdjustAmount('');
      setAdjustNote('');
    });
  };

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800">
      <div className="px-6 py-5">
        {editing ? (
          <BucketForm
            initial={{
              name: bucket.name,
              perMonth: bucket.monthly_accrual_cents > 0 ? (bucket.monthly_accrual_cents / 100).toFixed(2) : '',
              perYear: bucket.monthly_accrual_cents > 0 ? String(Math.round((bucket.monthly_accrual_cents * 12) / 100)) : '',
              target: bucket.target_cents !== null ? String(Math.round(bucket.target_cents / 100)) : '',
              opening: '',
              linked: bucket.linked_parent_ids.split(',').map(Number).filter((n) => Number.isFinite(n) && n > 0),
            }}
            parentCategories={parentCategories}
            showOpening={false}
            pending={isPending}
            onCancel={() => setEditing(false)}
            onSave={(input) =>
              startTransition(async () => {
                await updateBucketAction(bucket.id, input);
                setEditing(false);
              })
            }
          />
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: bucket.colour }} />
                <div>
                  <h2 className="text-sm font-semibold text-slate-200">{bucket.name}</h2>
                  <p className="text-xs text-slate-500">
                    {bucket.monthly_accrual_cents > 0
                      ? `${formatDollars(bucket.monthly_accrual_cents)}/mo · ${formatDollars(bucket.monthly_accrual_cents * 12)}/yr`
                      : 'No accrual set'}
                    {bucket.linkedParentNames.length > 0 && ` · deducts ${bucket.linkedParentNames.join(', ')} spend`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setEditing(true)} className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 transition-colors">
                  Edit
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    if (window.confirm(`Archive the "${bucket.name}" bucket? Its history is kept.`)) {
                      startTransition(() => archiveBucketAction(bucket.id));
                    }
                  }}
                  className="text-xs text-slate-600 hover:text-rose-400 border border-slate-800 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-50"
                >
                  Archive
                </button>
              </div>
            </div>

            <p className={`mt-3 text-3xl font-bold tabular-nums ${negative ? 'text-rose-400' : 'text-slate-100'}`}>
              {formatCurrency(bucket.balanceCents)}
              {bucket.target_cents !== null && (
                <span className="text-base font-medium text-slate-500"> / {formatDollars(bucket.target_cents)}</span>
              )}
            </p>

            {pct !== null && (
              <>
                <div className="mt-2.5 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: bucket.colour }} />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {pct}% of target
                  {toTarget !== null && toTarget > 0 && ` — reached ~${targetDateLabel(toTarget)} at this pace`}
                  {toTarget === 0 && ' — target reached 🎉'}
                </p>
              </>
            )}

            <p className="mt-3 text-xs text-slate-500 tabular-nums">
              Accrued {formatDollars(bucket.accruedCents)} over {bucket.monthsAccrued} mo
              {bucket.deductedCents > 0 && <> · spent −{formatDollars(bucket.deductedCents)}</>}
              {bucket.adjustedCents !== 0 && <> · adjustments {bucket.adjustedCents > 0 ? '+' : ''}{formatDollars(bucket.adjustedCents)}</>}
              {negative && <span className="text-rose-400"> · overspent — top up or raise the accrual</span>}
            </p>
          </>
        )}
      </div>

      {/* ── Activity + manual adjustment ────────────────────────────────── */}
      {!editing && (
        <div className="border-t border-slate-800/70 px-6 py-3">
          <button
            type="button"
            onClick={() => setShowActivity((v) => !v)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-300 transition-colors"
          >
            <span>Activity &amp; adjustments</span>
            <span>{showActivity ? '▴' : '▾'}</span>
          </button>
          {showActivity && (
            <div className="mt-3 space-y-3">
              {bucket.recentDeductions.length > 0 && (
                <div className="space-y-1.5">
                  {bucket.recentDeductions.map((t, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-400 truncate">
                        <span className="text-slate-600 tabular-nums mr-2">{formatDate(t.transaction_date)}</span>
                        {t.merchant && t.merchant !== 'Unknown' ? t.merchant : t.description.slice(0, 48)}
                      </span>
                      <span className="tabular-nums text-slate-300 shrink-0">{formatCurrency(t.amount_cents)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="Amount $"
                  className={`${inputClass} sm:w-28`}
                />
                <input
                  type="text"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="Note (optional)"
                  className={inputClass}
                />
                <div className="flex gap-2 shrink-0">
                  <button type="button" disabled={isPending} onClick={() => adjust(1)} className="px-3 py-1.5 rounded-lg border border-slate-700 text-sm text-emerald-400 hover:border-emerald-500 transition-colors disabled:opacity-50">
                    + Add
                  </button>
                  <button type="button" disabled={isPending} onClick={() => adjust(-1)} className="px-3 py-1.5 rounded-lg border border-slate-700 text-sm text-rose-400 hover:border-rose-500 transition-colors disabled:opacity-50">
                    − Withdraw
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── List + create ─────────────────────────────────────────────────────────────

export function BucketList({ buckets, parentCategories }: Props) {
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-4">
      {buckets.map((b) => (
        <BucketCard key={b.id} bucket={b} parentCategories={parentCategories} />
      ))}

      {creating ? (
        <div className="bg-slate-900 rounded-2xl border border-slate-800 px-6 py-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">New bucket</p>
          <BucketForm
            initial={{ name: '', perMonth: '', perYear: '', target: '', opening: '', linked: [] }}
            parentCategories={parentCategories}
            showOpening
            pending={isPending}
            onCancel={() => setCreating(false)}
            onSave={(input) =>
              startTransition(async () => {
                await createBucketAction(input, buckets.length);
                setCreating(false);
              })
            }
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-full rounded-2xl border border-dashed border-slate-700 px-6 py-4 text-sm text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
        >
          + New bucket
        </button>
      )}
    </div>
  );
}
