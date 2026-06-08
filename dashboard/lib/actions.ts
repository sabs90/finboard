'use server';

import { revalidatePath } from 'next/cache';
import { updateTransactionCategory } from '@/lib/db';

export async function reassignCategory(transactionId: number, categoryId: number): Promise<void> {
  updateTransactionCategory(transactionId, categoryId);
  revalidatePath('/spending');
  revalidatePath('/transactions');
}
