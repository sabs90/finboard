'use client';

import { useRef, useState, useTransition } from 'react';
import { runImport, type ImportResult } from '@/app/import/actions';

export function ImportForm() {
  const [source, setSource] = useState<'frollo' | 'amp'>('frollo');
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set('source', source);
    fd.set('file', file);
    setResult(null);
    startTransition(async () => {
      const res = await runImport(fd);
      setResult(res);
      if (res.ok && fileRef.current) {
        fileRef.current.value = '';
        setFileName(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
        <p className="text-sm text-slate-500">
          Upload a bank CSV export. The matching ingest script runs on the server, deduplicates against
          existing data, and applies your category rules. Safe to re-run the same file — duplicates are skipped.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as 'frollo' | 'amp')}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
            >
              <option value="frollo">Frollo (ANZ / HSBC)</option>
              <option value="amp">AMP</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
            <label className="text-xs text-slate-500">CSV file</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              className="text-sm text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-800 file:text-slate-200 file:text-sm hover:file:bg-slate-700"
            />
          </div>

          <button
            type="submit"
            disabled={isPending || !fileName}
            className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
          >
            {isPending ? 'Importing…' : 'Upload & ingest'}
          </button>
        </div>
      </form>

      {result && (
        <div className={`bg-slate-900 rounded-2xl border p-6 ${result.ok ? 'border-emerald-500/30' : 'border-rose-500/30'}`}>
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-sm font-semibold ${result.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
              {result.ok ? '✓ Ingest complete' : '✕ Ingest failed'}
            </span>
            {result.filename && <span className="text-xs text-slate-500">{result.filename}</span>}
          </div>
          <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono max-h-[360px] overflow-y-auto">
            {result.log}
          </pre>
        </div>
      )}
    </div>
  );
}
