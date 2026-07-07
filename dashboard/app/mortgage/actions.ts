'use server';

import { revalidatePath } from 'next/cache';
import { updateMortgageSettings } from '@/lib/db';

/** Update the mortgage projection settings (rate as %, repayment in dollars). */
export async function saveMortgageSettingsAction(
  ratePercent: number | null,
  repaymentDollars: number | null,
  label: string,
): Promise<void> {
  const rate = ratePercent !== null && Number.isFinite(ratePercent) && ratePercent > 0
    ? ratePercent / 100
    : null;
  const repayment = repaymentDollars !== null && Number.isFinite(repaymentDollars) && repaymentDollars > 0
    ? Math.round(repaymentDollars * 100)
    : null;
  updateMortgageSettings(rate, repayment, label.trim() || 'Home Loan');
  revalidatePath('/mortgage');
  revalidatePath('/');
}
