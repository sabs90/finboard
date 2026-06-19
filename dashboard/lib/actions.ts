'use server';

import { revalidatePath } from 'next/cache';
import {
  updateTransactionCategory,
  upsertBudget,
  updateTransactionFlag,
  updateTransactionNote,
  createCategoryRule,
  deleteCategoryRule,
  countRuleMatches,
  applyCategorisations,
  saveBalanceSnapshot,
  dismissRecurring,
  restoreRecurring,
  type RuleType,
  type CategorisationEdit,
  type CategorisationSummary,
  type BalanceEntry,
  type SaveBalanceResult,
} from '@/lib/db';

export async function reassignCategory(transactionId: number, categoryId: number): Promise<void> {
  updateTransactionCategory(transactionId, categoryId);
  revalidatePath('/spending');
  revalidatePath('/transactions');
}

export async function setBudget(categoryId: number, month: string, amountCents: number): Promise<void> {
  upsertBudget(categoryId, month, amountCents);
  revalidatePath('/budget');
}

export async function toggleTransactionFlag(transactionId: number, flagged: boolean): Promise<void> {
  updateTransactionFlag(transactionId, flagged);
  revalidatePath('/transactions');
}

export async function setTransactionNote(transactionId: number, note: string): Promise<void> {
  updateTransactionNote(transactionId, note);
  revalidatePath('/transactions');
}

export async function previewRuleMatches(ruleType: RuleType, pattern: string): Promise<number> {
  return countRuleMatches(ruleType, pattern);
}

export async function addCategoryRule(
  ruleType: RuleType,
  pattern: string,
  categoryId: number,
): Promise<{ affected: number }> {
  const result = createCategoryRule(ruleType, pattern, categoryId);
  revalidatePath('/rules');
  revalidatePath('/transactions');
  revalidatePath('/spending');
  return result;
}

export async function removeCategoryRule(id: number): Promise<void> {
  deleteCategoryRule(id);
  revalidatePath('/rules');
}

export async function applyBulkCategorisation(edits: CategorisationEdit[]): Promise<CategorisationSummary> {
  const summary = applyCategorisations(edits);
  revalidatePath('/categorise');
  revalidatePath('/transactions');
  revalidatePath('/spending');
  revalidatePath('/rules');
  return summary;
}

export async function hideRecurring(merchant: string): Promise<void> {
  dismissRecurring(merchant);
  revalidatePath('/recurring');
  revalidatePath('/');
}

export async function unhideRecurring(merchant: string): Promise<void> {
  restoreRecurring(merchant);
  revalidatePath('/recurring');
  revalidatePath('/');
}

export async function saveBalances(date: string, entries: BalanceEntry[]): Promise<SaveBalanceResult> {
  const result = saveBalanceSnapshot(date, entries);
  revalidatePath('/balance-input');
  revalidatePath('/balance-sheet');
  revalidatePath('/networth');
  revalidatePath('/');
  return result;
}
