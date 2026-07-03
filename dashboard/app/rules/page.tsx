import { getCategoryRules, getAllCategories } from '@/lib/db';
import { RuleManager } from '@/components/rules/RuleManager';
import { RecategoriseButton } from '@/components/rules/RecategoriseButton';

export default function RulesPage() {
  const rules = getCategoryRules();
  const categories = getAllCategories();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Category Rules</h1>
        <span className="text-sm text-slate-400">{rules.length} rules</span>
      </div>
      <RuleManager rules={rules} categories={categories} />
      <RecategoriseButton />
    </div>
  );
}
