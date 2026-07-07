'use client';

import { useState, useTransition } from 'react';
import { saveMortgageSettingsAction } from '@/app/mortgage/actions';

interface Props {
  label: string;
  ratePercent: number | null;      // e.g. 6.44
  repaymentDollars: number | null; // e.g. 4969.25
}

const inputClass =
  'bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-100 ' +
  'placeholder:text-slate-500 focus:outline-none focus:border-slate-500 w-full tabular-nums';

export function MortgageSettingsPanel({ label, ratePercent, repaymentDollars }: Props) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [labelInput, setLabelInput] = useState(label);
  const [rateInput, setRateInput] = useState(ratePercent !== null ? ratePercent.toFixed(2) : '');
  const [repayInput, setRepayInput] = useState(repaymentDollars !== null ? repaymentDollars.toFixed(2) : '');
  const [saved, setSaved] = useState(false);

  const save = () => {
    const rate = parseFloat(rateInput.replace(/[%\s]/g, ''));
    const repay = parseFloat(repayInput.replace(/[$,\s]/g, ''));
    startTransition(async () => {
      await saveMortgageSettingsAction(
        Number.isFinite(rate) ? rate : null,
        Number.isFinite(repay) ? repay : null,
        labelInput,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wide hover:text-slate-200 transition-colors"
      >
        <span>Loan settings</span>
        <span>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-xs text-slate-500 mb-3">
            The rate defaults to the latest balance-sheet facility rate; the repayment to the median
            of recent AMP direct debits. Override either when the lender changes them.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1" htmlFor="mtg-label">Label</label>
              <input id="mtg-label" type="text" value={labelInput} onChange={(e) => setLabelInput(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1" htmlFor="mtg-rate">Interest rate % p.a.</label>
              <input id="mtg-rate" type="text" inputMode="decimal" value={rateInput} onChange={(e) => setRateInput(e.target.value)} placeholder="6.44" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1" htmlFor="mtg-repay">Monthly repayment $</label>
              <input id="mtg-repay" type="text" inputMode="decimal" value={repayInput} onChange={(e) => setRepayInput(e.target.value)} placeholder="4969.25" className={inputClass} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={isPending}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium text-white transition-colors disabled:opacity-50"
            >
              Save
            </button>
            {saved && <span className="text-sm text-emerald-400">Saved ✓</span>}
          </div>
        </div>
      )}
    </div>
  );
}
