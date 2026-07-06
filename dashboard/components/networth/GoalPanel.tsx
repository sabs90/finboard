'use client';

import { useState, useTransition } from 'react';
import { formatDate, formatDollars } from '@/lib/formatters';
import { saveGoalAction, clearGoalAction, addMilestoneAction, deleteMilestoneAction } from '@/app/networth/actions';
import type { NetWorthGoal, MilestoneRow } from '@/lib/db';

interface Props {
  goal: NetWorthGoal | null;
  currentCents: number;
  quarterlyGrowthCents: number;
  projectedDate: string | null;
  milestones: MilestoneRow[];
}

const inputClass =
  'bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 ' +
  'placeholder:text-slate-500 focus:outline-none focus:border-slate-500 w-full';

export function GoalPanel({ goal, currentCents, quarterlyGrowthCents, projectedDate, milestones }: Props) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [showMilestones, setShowMilestones] = useState(false);

  const [targetInput, setTargetInput] = useState(goal ? String(Math.round(goal.target_cents / 100)) : '');
  const [labelInput, setLabelInput] = useState(goal?.label ?? '');
  const [msDate, setMsDate] = useState('');
  const [msLabel, setMsLabel] = useState('');

  const pct = goal && goal.target_cents > 0
    ? Math.min(100, Math.round((currentCents / goal.target_cents) * 100))
    : null;
  const reached = goal !== null && currentCents >= goal.target_cents;

  const saveGoal = () => {
    const dollars = parseFloat(targetInput.replace(/[$,\s]/g, ''));
    if (!Number.isFinite(dollars) || dollars <= 0) return;
    startTransition(async () => {
      await saveGoalAction(dollars, labelInput);
      setEditing(false);
    });
  };

  const addMs = () => {
    if (!msDate || !msLabel.trim()) return;
    startTransition(async () => {
      await addMilestoneAction(msDate, msLabel);
      setMsDate('');
      setMsLabel('');
    });
  };

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800">
      <div className="px-6 py-5">
        {/* ── Goal summary / edit ─────────────────────────────────────── */}
        {goal && !editing ? (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{goal.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-100 tabular-nums">
                  {formatDollars(currentCents)}
                  <span className="text-base font-medium text-slate-500"> / {formatDollars(goal.target_cents)}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1.5 transition-colors"
              >
                Edit
              </button>
            </div>
            <div className="mt-3 h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${reached ? 'bg-emerald-400' : 'bg-emerald-500'}`}
                style={{ width: `${pct ?? 0}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-slate-400">
                <span className="font-semibold text-slate-200">{pct}%</span> there
                {!reached && <> — {formatDollars(goal.target_cents - currentCents)} to go</>}
              </span>
              {reached ? (
                <span className="text-emerald-400 font-medium">Goal reached 🎉</span>
              ) : projectedDate ? (
                <span className="text-slate-400">
                  On trend (<span className="tabular-nums">{formatDollars(quarterlyGrowthCents)}</span>/quarter):
                  reached <span className="font-semibold text-slate-200">{formatDate(projectedDate)}</span>
                </span>
              ) : (
                <span className="text-amber-400">Trend is flat or negative — no projected date</span>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {goal ? 'Edit goal' : 'Set a net worth goal'}
            </p>
            {!goal && (
              <p className="mt-1 text-sm text-slate-500">
                Track progress towards a target — a FIRE number, the next million, anything.
              </p>
            )}
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                placeholder="Target, e.g. 2000000"
                className={inputClass}
              />
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="Label (optional), e.g. FIRE number"
                className={inputClass}
              />
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={saveGoal}
                  disabled={isPending}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white transition-colors disabled:opacity-50"
                >
                  Save
                </button>
                {goal && (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 text-sm text-slate-300 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => startTransition(async () => { await clearGoalAction(); setEditing(false); })}
                      disabled={isPending}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 text-sm text-rose-400 hover:text-rose-300 transition-colors disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Milestones ──────────────────────────────────────────────────── */}
      <div className="border-t border-slate-800/70 px-6 py-3">
        <button
          type="button"
          onClick={() => setShowMilestones((v) => !v)}
          className="w-full flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wide hover:text-slate-200 transition-colors"
        >
          <span>Milestones ({milestones.length})</span>
          <span>{showMilestones ? '▴' : '▾'}</span>
        </button>
        {showMilestones && (
          <div className="mt-3 space-y-2">
            {milestones.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-300">
                  <span className="text-slate-500 tabular-nums mr-2">{formatDate(m.milestone_date)}</span>
                  {m.label}
                </span>
                <button
                  type="button"
                  onClick={() => startTransition(() => deleteMilestoneAction(m.id))}
                  disabled={isPending}
                  aria-label={`Delete milestone ${m.label}`}
                  className="text-slate-600 hover:text-rose-400 transition-colors disabled:opacity-50"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <input
                type="date"
                value={msDate}
                onChange={(e) => setMsDate(e.target.value)}
                className={`${inputClass} sm:w-40`}
              />
              <input
                type="text"
                value={msLabel}
                onChange={(e) => setMsLabel(e.target.value)}
                placeholder="e.g. Granny flat complete"
                className={inputClass}
              />
              <button
                type="button"
                onClick={addMs}
                disabled={isPending || !msDate || !msLabel.trim()}
                className="shrink-0 px-4 py-1.5 rounded-lg border border-slate-700 text-sm text-slate-300 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
