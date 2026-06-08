/**
 * Format cents as AUD currency string.
 * Negative values shown with minus sign: -$12.50
 */
export function formatCurrency(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = (abs / 100).toFixed(2);
  const formatted = '$' + dollars.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return cents < 0 ? `-${formatted}` : formatted;
}

/**
 * Format ISO date string (YYYY-MM-DD) to Australian format (DD MMM YYYY).
 */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
}

/**
 * Format a YYYY-MM month string to display format (e.g. "Jun 2026").
 */
export function formatMonth(month: string): string {
  const [year, m] = month.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m, 10) - 1]} ${year}`;
}

/**
 * Get the current month as YYYY-MM.
 */
export function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Get the previous month given a YYYY-MM string.
 */
export function prevMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  if (m === 1) return `${year - 1}-12`;
  return `${year}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * Get the next month given a YYYY-MM string.
 */
export function nextMonth(month: string): string {
  const [year, m] = month.split('-').map(Number);
  if (m === 12) return `${year + 1}-01`;
  return `${year}-${String(m + 1).padStart(2, '0')}`;
}
