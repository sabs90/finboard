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
  type RuleType,
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
