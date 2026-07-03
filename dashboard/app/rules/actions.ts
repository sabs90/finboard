'use server';

import path from 'path';
import { spawn } from 'child_process';
import { revalidatePath } from 'next/cache';

// Dashboard runs from dashboard/; scripts + data live one level up.
const PROJECT_ROOT = path.resolve(process.cwd(), '..');
// Resolve the DB the same way lib/db.ts does, then pass it to the script as an
// absolute path — the script runs with cwd=PROJECT_ROOT, so a relative DB_PATH
// would otherwise resolve to a different (empty) file. See app/import/actions.ts.
const DB_PATH = path.resolve(process.cwd(), process.env.DB_PATH || '../data/finance.db');

export interface RecategoriseResult {
  ok: boolean;
  log: string;
  updated: number | null;
}

export async function runRecategorise(): Promise<RecategoriseResult> {
  const scriptPath = path.join(PROJECT_ROOT, 'scripts', 'recategorise.py');

  const { code, out } = await new Promise<{ code: number | null; out: string }>((resolve) => {
    const child = spawn('python3', [scriptPath], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, DB_PATH },
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { out += d.toString(); });
    child.on('error', (err) => resolve({ code: 1, out: `Failed to launch python3: ${err.message}` }));
    child.on('close', (c) => resolve({ code: c, out }));
  });

  const updated = Number(out.match(/updated:\s*(\d+)/)?.[1] ?? NaN);

  if (code === 0) {
    revalidatePath('/spending');
    revalidatePath('/transactions');
    revalidatePath('/');
  }

  return {
    ok: code === 0,
    log: `${out.trim()}\n\n[Recategorise exited with code ${code}]`,
    updated: Number.isNaN(updated) ? null : updated,
  };
}
