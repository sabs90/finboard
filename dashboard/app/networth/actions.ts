'use server';

import { revalidatePath } from 'next/cache';
import { setNetWorthGoal, addMilestone, deleteMilestone } from '@/lib/db';

function revalidate(): void {
  revalidatePath('/networth');
  revalidatePath('/');
}

/** Save (or clear, when dollars <= 0) the single net-worth goal. */
export async function saveGoalAction(targetDollars: number, label: string): Promise<void> {
  const cents = Math.round(targetDollars * 100);
  setNetWorthGoal(cents, label.trim() || 'Net worth goal');
  revalidate();
}

export async function clearGoalAction(): Promise<void> {
  setNetWorthGoal(0, '');
  revalidate();
}

export async function addMilestoneAction(date: string, label: string): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !label.trim()) return;
  addMilestone(date, label.trim());
  revalidate();
}

export async function deleteMilestoneAction(id: number): Promise<void> {
  deleteMilestone(id);
  revalidate();
}
