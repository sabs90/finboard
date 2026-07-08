'use server';

import { revalidatePath } from 'next/cache';
import { createBucket, updateBucket, archiveBucket, addBucketAdjustment } from '@/lib/db';

const BUCKET_COLOURS = ['#14B8A6', '#F59E0B', '#8B5CF6', '#3B82F6', '#EC4899', '#22C55E', '#F97316', '#06B6D4'];

export interface BucketInput {
  name: string;
  monthlyAccrualDollars: number;
  targetDollars: number | null;
  linkedParentIds: number[];
  openingBalanceDollars?: number;
}

function toCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export async function createBucketAction(input: BucketInput, existingCount: number): Promise<void> {
  if (!input.name.trim()) return;
  createBucket(
    input.name.trim(),
    BUCKET_COLOURS[existingCount % BUCKET_COLOURS.length],
    toCents(Math.max(0, input.monthlyAccrualDollars || 0)),
    input.targetDollars !== null && input.targetDollars > 0 ? toCents(input.targetDollars) : null,
    input.linkedParentIds,
    toCents(Math.max(0, input.openingBalanceDollars ?? 0)),
  );
  revalidatePath('/buckets');
}

export async function updateBucketAction(id: number, input: BucketInput): Promise<void> {
  if (!input.name.trim()) return;
  updateBucket(
    id,
    input.name.trim(),
    toCents(Math.max(0, input.monthlyAccrualDollars || 0)),
    input.targetDollars !== null && input.targetDollars > 0 ? toCents(input.targetDollars) : null,
    input.linkedParentIds,
  );
  revalidatePath('/buckets');
}

export async function archiveBucketAction(id: number): Promise<void> {
  archiveBucket(id);
  revalidatePath('/buckets');
}

export async function adjustBucketAction(id: number, amountDollars: number, note: string): Promise<void> {
  if (!Number.isFinite(amountDollars) || amountDollars === 0) return;
  addBucketAdjustment(id, toCents(amountDollars), note);
  revalidatePath('/buckets');
}
