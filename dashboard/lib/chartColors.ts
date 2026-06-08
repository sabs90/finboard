export const CATEGORY_COLORS: Record<string, string> = {
  'Income': '#22C55E',
  'Housing': '#8B5CF6',
  'Food & Drink': '#F59E0B',
  'Transport': '#3B82F6',
  'Health': '#EF4444',
  'Utilities': '#06B6D4',
  'Entertainment': '#EC4899',
  'Shopping': '#F97316',
  'Travel': '#14B8A6',
  'Education': '#6366F1',
  'Financial': '#64748B',
  'Investments': '#10B981',
  'Transfers': '#94A3B8',
  'Uncategorised': '#9CA3AF',
  'Tech': '#818CF8',
  'Property': '#A78BFA',
  'Family': '#FB923C',
  'Islam': '#34D399',
};

const FALLBACK_COLOR = '#6B7280';

export function getCategoryColor(name: string): string {
  return CATEGORY_COLORS[name] ?? FALLBACK_COLOR;
}

/**
 * A palette of visually distinct colors for subcategories.
 * Designed to be readable against dark backgrounds.
 */
const SUB_PALETTE = [
  '#F59E0B', // amber
  '#06B6D4', // cyan
  '#8B5CF6', // violet
  '#EF4444', // red
  '#22C55E', // green
  '#EC4899', // pink
  '#3B82F6', // blue
  '#F97316', // orange
  '#14B8A6', // teal
  '#6366F1', // indigo
  '#A855F7', // purple
  '#F43F5E', // rose
  '#0EA5E9', // sky
  '#84CC16', // lime
  '#D946EF', // fuchsia
];

/**
 * Assign distinct colors to a list of subcategory names.
 * Returns a stable mapping (same name always gets same color within a session).
 */
export function assignSubcategoryColors(names: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  names.forEach((name, i) => {
    map[name] = SUB_PALETTE[i % SUB_PALETTE.length];
  });
  return map;
}
