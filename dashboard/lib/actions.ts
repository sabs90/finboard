'use server';

import { revalidatePath } from 'next/cache';
import { updateTransactionCategory, upsertBudget } from '@/lib/db';

export async function reassignCategory(transactionId: number, categoryId: number): Promise<void> {
  updateTransactionCategory(transactionId, categoryId);
  revalidatePath('/spending');
  revalidatePath('/transactions');
}

export async function setBudget(categoryId: number, month: string, amountCents: number): Promise<void> {
  upsertBudget(categoryId, month, amountCents);
  revalidatePath('/budget');
}
