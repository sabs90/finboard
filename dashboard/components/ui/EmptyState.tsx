import { Card } from '@/components/ui/Card';

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: React.ReactNode;
}

/** Shared empty-state panel for views with no data to show yet. */
export function EmptyState({ title, message, icon }: EmptyStateProps) {
  return (
    <Card>
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        {icon && <div className="text-slate-600">{icon}</div>}
        <p className="text-sm font-medium text-slate-300">{title}</p>
        {message && <p className="max-w-sm text-sm text-slate-500">{message}</p>}
      </div>
    </Card>
  );
}
