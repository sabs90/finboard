'use server';

import { promises as fs } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { revalidatePath } from 'next/cache';

// Dashboard runs from dashboard/; scripts + data live one level up.
const PROJECT_ROOT = path.resolve(process.cwd(), '..');

const SOURCES = {
  frollo: { script: 'scripts/ingest_frollo.py', dir: 'data/exports/frollo', label: 'Frollo' },
  amp: { script: 'scripts/ingest_amp.py', dir: 'data/exports/amp', label: 'AMP' },
} as const;

type Source = keyof typeof SOURCES;

export interface ImportResult {
  ok: boolean;
  log: string;
  filename?: string;
}

function runScript(scriptPath: string, filePath: string): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const child = spawn('python3', [scriptPath, '--file', filePath], { cwd: PROJECT_ROOT });
    let out = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { out += d.toString(); });
    child.on('error', (err) => resolve({ code: 1, out: `Failed to launch python3: ${err.message}` }));
    child.on('close', (code) => resolve({ code, out }));
  });
}

export async function runImport(formData: FormData): Promise<ImportResult> {
  const source = formData.get('source');
  const file = formData.get('file');

  if (typeof source !== 'string' || !(source in SOURCES)) {
    return { ok: false, log: 'Invalid source selected.' };
  }
  if (!file || typeof file === 'string' || file.size === 0) {
    return { ok: false, log: 'No file uploaded.' };
  }

  const cfg = SOURCES[source as Source];
  const safeName = path.basename(file.name).replace(/[^\w.\-]/g, '_') || 'upload.csv';
  if (!safeName.toLowerCase().endsWith('.csv')) {
    return { ok: false, log: 'Please upload a .csv file.' };
  }

  const destDir = path.join(PROJECT_ROOT, cfg.dir);
  await fs.mkdir(destDir, { recursive: true });
  const destPath = path.join(destDir, safeName);
  await fs.writeFile(destPath, Buffer.from(await file.arrayBuffer()));

  const { code, out } = await runScript(path.join(PROJECT_ROOT, cfg.script), destPath);

  if (code === 0) {
    revalidatePath('/transactions');
    revalidatePath('/');
    revalidatePath('/spending');
  }

  return {
    ok: code === 0,
    log: `${out.trim()}\n\n[${cfg.label} ingest exited with code ${code}]`,
    filename: safeName,
  };
}
