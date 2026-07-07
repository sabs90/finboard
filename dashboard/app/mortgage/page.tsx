import { getMortgageData } from '@/lib/db';
import { formatDollars, formatDate } from '@/lib/formatters';
import { amortise, addMonthsIso, formatMonthsAsYears } from '@/lib/mortgage';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { MortgageHistoryChart } from '@/components/charts/MortgageHistoryChart';
import { MortgageCalculator } from '@/components/mortgage/MortgageCalculator';
import { MortgageSettingsPanel } from '@/components/mortgage/MortgageSettingsPanel';

export default function MortgagePage() {
  const data = getMortgageData();

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-100 mb-6">Mortgage</h1>
        <EmptyState
          title="No mortgage data yet"
          message="Load the balance sheet (scripts/ingest_balance_sheet.py) so the loan facilities and offset balances exist."
        />
      </div>
    );
  }

  const { settings, summary, history, propertyName, propertyValueCents } = data;
  const rate = settings.annual_rate;
  const repayment = settings.monthly_repayment_cents;

  // Effective rate: interest is only charged on the net balance, so the
  // offset effectively discounts the headline rate.
  const effectiveRate = rate !== null && summary.loanCents > 0
    ? rate * (summary.netCents / summary.loanCents)
    : null;
  const monthlyInterestCents = rate !== null ? Math.round((summary.netCents * rate) / 12) : null;
  const offsetSavingsPaCents = rate !== null ? Math.round(summary.offsetCents * rate) : null;

  const canProject = rate !== null && repayment !== null && repayment > 0;
  const baseline = canProject
    ? amortise({
        balanceCents: summary.loanCents,
        offsetCents: summary.offsetCents,
        annualRate: rate,
        monthlyRepaymentCents: repayment,
      })
    : null;

  // Offset time-saved: compare payoff with vs without the offset balance.
  const noOffset = canProject
    ? amortise({
        balanceCents: summary.loanCents,
        offsetCents: 0,
        annualRate: rate,
        monthlyRepaymentCents: repayment,
      })
    : null;
  const offsetMonthsSaved = baseline?.paysOff && noOffset?.paysOff
    ? noOffset.months - baseline.months
    : null;

  const equityCents = propertyValueCents !== null ? propertyValueCents - summary.loanCents : null;
  const lvr = propertyValueCents !== null && propertyValueCents > 0
    ? (summary.loanCents / propertyValueCents) * 100
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Mortgage</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {settings.label}{propertyName ? ` — ${propertyName}` : ''}
          </p>
        </div>
        <span className="text-sm text-slate-500">As at {formatDate(summary.asOf)}</span>
      </div>

      {/* ── Position ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Loan balance" value={formatDollars(summary.loanCents)} />
        <KpiCard
          label="Offset balance"
          value={formatDollars(summary.offsetCents)}
          subtitle={offsetSavingsPaCents !== null ? `Saves ${formatDollars(offsetSavingsPaCents)}/yr interest` : undefined}
        />
        <KpiCard
          label="Net balance"
          value={formatDollars(summary.netCents)}
          subtitle="Interest charged on this"
        />
        <KpiCard
          label="Interest rate"
          value={rate !== null ? `${(rate * 100).toFixed(2)}%` : '—'}
          subtitle={effectiveRate !== null ? `Effective ${(effectiveRate * 100).toFixed(2)}% after offset` : undefined}
        />
      </div>

      {/* ── Repayments & payoff ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Monthly repayment"
          value={repayment !== null ? formatDollars(repayment) : '—'}
          subtitle="Median of recent direct debits"
        />
        <KpiCard
          label="Interest per month"
          value={monthlyInterestCents !== null ? formatDollars(monthlyInterestCents) : '—'}
          subtitle={
            repayment !== null && monthlyInterestCents !== null
              ? `${formatDollars(Math.max(0, repayment - monthlyInterestCents))} goes to principal`
              : undefined
          }
        />
        <KpiCard
          label="Paid off"
          value={
            baseline === null ? '—'
            : baseline.paysOff ? formatDate(addMonthsIso(summary.asOf, baseline.months))
            : 'Never'
          }
          subtitle={
            baseline === null ? undefined
            : baseline.paysOff ? `${formatMonthsAsYears(baseline.months)} at current pace`
            : 'Repayments only cover interest'
          }
        />
        <KpiCard
          label="Interest remaining"
          value={baseline !== null ? formatDollars(baseline.totalInterestCents) : '—'}
          subtitle={baseline?.paysOff ? 'If nothing changes' : baseline ? 'Over the next 50 years' : undefined}
        />
      </div>

      {/* ── Offset benefit + equity ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 rounded-2xl border border-slate-800 px-6 py-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Offset benefit</p>
          {offsetSavingsPaCents !== null ? (
            <>
              <p className="mt-2 text-2xl font-bold text-emerald-400 tabular-nums">
                {formatDollars(offsetSavingsPaCents)}<span className="text-base font-medium text-slate-500">/yr</span>
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Your {formatDollars(summary.offsetCents)} offset avoids interest at {(rate! * 100).toFixed(2)}% — a
                tax-free, risk-free return{offsetMonthsSaved !== null && offsetMonthsSaved > 0 && (
                  <>, and pays the loan off <span className="text-slate-200 font-medium">{formatMonthsAsYears(offsetMonthsSaved)} sooner</span></>
                )}.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Set the interest rate in Loan settings to see the offset benefit.</p>
          )}
        </div>
        <div className="bg-slate-900 rounded-2xl border border-slate-800 px-6 py-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Equity &amp; LVR</p>
          {equityCents !== null && lvr !== null ? (
            <>
              <p className="mt-2 text-2xl font-bold text-slate-100 tabular-nums">
                {formatDollars(equityCents)}
                <span className="text-base font-medium text-slate-500"> equity · {lvr.toFixed(0)}% LVR</span>
              </p>
              <div className="mt-3 h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${lvr <= 60 ? 'bg-emerald-500' : lvr <= 80 ? 'bg-amber-500' : 'bg-rose-500'}`}
                  style={{ width: `${Math.min(100, lvr)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {propertyName} valued at {formatDollars(propertyValueCents!)} — under 80% LVR avoids
                lenders mortgage insurance; under 60% unlocks the sharpest rates.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No property valuation found for this loan.</p>
          )}
        </div>
      </div>

      {/* ── Balance over time ────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Balance Over Time</CardTitle>
        </CardHeader>
        <div className="px-6 pb-6">
          <MortgageHistoryChart data={history} />
        </div>
      </Card>

      {/* ── Extra repayments calculator ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Pay It Off Faster</CardTitle>
        </CardHeader>
        <div className="px-6 pb-6">
          {canProject ? (
            <MortgageCalculator
              balanceCents={summary.loanCents}
              offsetCents={summary.offsetCents}
              annualRate={rate}
              monthlyRepaymentCents={repayment}
              startDate={summary.asOf}
            />
          ) : (
            <p className="text-sm text-slate-500 py-4">
              Set the interest rate and monthly repayment in Loan settings to run payoff projections.
            </p>
          )}
        </div>
      </Card>

      {/* ── Settings ─────────────────────────────────────────────────────── */}
      <MortgageSettingsPanel
        label={settings.label}
        ratePercent={rate !== null ? rate * 100 : null}
        repaymentDollars={repayment !== null ? repayment / 100 : null}
      />
    </div>
  );
}
