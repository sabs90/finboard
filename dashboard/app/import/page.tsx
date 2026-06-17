import { ImportForm } from '@/components/import/ImportForm';

export default function ImportPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Import Data</h1>
      <ImportForm />
    </div>
  );
}
