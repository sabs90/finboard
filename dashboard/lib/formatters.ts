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
 * Format cents as whole-dollar AUD string (no decimals).
 * e.g. 159742 → "$1,597"
 */
export function formatDollars(cents: number): string {
  const abs = Math.abs(cents);
  const dollars = Math.round(abs / 100).toString();
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

/**
 * Get date range for a period (number of months back from current month).
 * Returns [startDate, endDate] as YYYY-MM-DD strings.
 * startDate is first day of the period, endDate is first day of next month.
 */
export function getDateRange(periodMonths: number): { startDate: string; endDate: string } {
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  // Move endDate to start of next month (exclusive upper bound)
  const nextM = endMonth === 12 ? 1 : endMonth + 1;
  const nextY = endMonth === 12 ? endYear + 1 : endYear;
  const exclusiveEnd = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

  // Start date is periodMonths back
  let startMonth = endMonth - periodMonths + 1;
  let startYear = endYear;
  while (startMonth <= 0) {
    startMonth += 12;
    startYear -= 1;
  }
  const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;

  return { startDate, endDate: exclusiveEnd };
}
