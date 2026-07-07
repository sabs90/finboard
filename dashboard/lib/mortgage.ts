/**
 * Mortgage amortisation maths, shared by the /mortgage server page and the
 * interactive calculator (client). Pure functions — no DB access.
 *
 * Model (standard Australian offset loan, monthly steps):
 *   interest for the month = max(0, balance − offset) × annualRate / 12
 *   balance += interest − (repayment + extra)
 * The offset balance is held constant. Interest-only situations fall out
 * naturally: if the repayment doesn't exceed the interest charge the loan
 * never amortises and `paysOff` is false.
 */

export interface AmortiseParams {
  balanceCents: number;
  offsetCents: number;
  annualRate: number; // decimal, e.g. 0.0644
  monthlyRepaymentCents: number;
  extraMonthlyCents?: number;
  lumpSumCents?: number; // applied immediately, before month 1
}

export interface AmortisePoint {
  month: number; // months from now (0 = today)
  balanceCents: number;
}

export interface AmortiseResult {
  paysOff: boolean;
  months: number; // months to payoff (MAX_MONTHS when paysOff is false)
  totalInterestCents: number;
  schedule: AmortisePoint[];
}

/** 50-year simulation cap — beyond this we call the loan "never repaid". */
export const MAX_MONTHS = 600;

export function amortise(params: AmortiseParams): AmortiseResult {
  const {
    balanceCents,
    offsetCents,
    annualRate,
    monthlyRepaymentCents,
    extraMonthlyCents = 0,
    lumpSumCents = 0,
  } = params;

  const monthlyRate = annualRate / 12;
  const payment = monthlyRepaymentCents + extraMonthlyCents;

  let balance = Math.max(0, balanceCents - lumpSumCents);
  let totalInterest = 0;
  const schedule: AmortisePoint[] = [{ month: 0, balanceCents: balance }];

  for (let m = 1; m <= MAX_MONTHS; m++) {
    const interest = Math.round(Math.max(0, balance - offsetCents) * monthlyRate);
    totalInterest += interest;
    balance = balance + interest - payment;
    if (balance <= 0) {
      // Last payment only needs to cover the remainder.
      totalInterest = Math.max(0, totalInterest);
      schedule.push({ month: m, balanceCents: 0 });
      return { paysOff: true, months: m, totalInterestCents: totalInterest, schedule };
    }
    schedule.push({ month: m, balanceCents: balance });
  }

  return { paysOff: false, months: MAX_MONTHS, totalInterestCents: totalInterest, schedule };
}

/** "7 yr 4 mo" style duration label. */
export function formatMonthsAsYears(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} mo`;
  if (m === 0) return `${y} yr`;
  return `${y} yr ${m} mo`;
}

/** Add n months to an ISO date (YYYY-MM-DD), clamping to the target month end. */
export function addMonthsIso(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
