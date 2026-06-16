import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), process.env.DB_PATH || '../data/finance.db');

function getDb(): Database.Database {
  const globalAny = globalThis as unknown as { _findb?: Database.Database };
  if (!globalAny._findb) {
    globalAny._findb = new Database(DB_PATH);
    globalAny._findb.pragma('journal_mode = WAL');
    globalAny._findb.pragma('foreign_keys = ON');
  }
  return globalAny._findb;
}

export interface MonthlySpendRow {
  parent_category_id: number | null;
  parent_category: string | null;
  category_id: number;
  category: string;
  colour: string | null;
  total_cents: number;
  transaction_count: number;
}

export interface TransactionRow {
  id: number;
  transaction_date: string;
  amount_cents: number;
  description: string;
  merchant: string | null;
  category_id: number | null;
  category: string | null;
  parent_category: string | null;
  account_name: string;
}

export interface CategoryRow {
  id: number;
  name: string;
  parent_id: number | null;
  parent_name: string | null;
}

export interface OverviewKpis {
  totalSpendCents: number;
  totalIncomeCents: number;
  transactionCount: number;
  topCategory: string;
  topCategoryCents: number;
}

export interface CategoryBreakdownRow {
  parent_category: string;
  colour: string;
  total_cents: number;
}

export interface MonthlyTotalRow {
  month: string;
  total_cents: number;
}

export interface RecentTransactionRow {
  id: number;
  transaction_date: string;
  amount_cents: number;
  description: string;
  merchant: string | null;
  category: string | null;
  parent_category: string | null;
  colour: string | null;
  account_name: string;
}

export interface AccountRow {
  id: number;
  name: string;
}

export interface CategoryInfo {
  id: number;
  name: string;
  colour: string;
  parent_id: number | null;
  parent_name: string | null;
  parent_colour: string | null;
}

export interface CategoryTrendRow {
  month: string;
  total_cents: number;
}

export interface StackedTrendRow {
  month: string;
  category: string;
  total_cents: number;
}

export interface SubcategoryRow {
  category_id: number;
  category: string;
  total_cents: number;
}

export interface PivotRow {
  parent_category_id: number | null;
  parent_category: string;
  parent_colour: string;
  category_id: number | null;
  category: string | null;
  month: string;
  total_cents: number;
}

export interface MerchantRow {
  merchant: string;
  total_cents: number;
  transaction_count: number;
}

export interface ParentCategoryRow {
  id: number;
  name: string;
  colour: string;
}

export interface ChildCategoryRow {
  id: number;
  name: string;
  parent_id: number;
  parent_name: string;
}

export interface TransactionSearchParams {
  query?: string;
  accountId?: number;
  categoryId?: number;
  month?: string;
  page: number;
  pageSize: number;
}

export interface TransactionSearchResult {
  transactions: TransactionRow[];
  total: number;
}

export function getMonthlySpend(month: string): MonthlySpendRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      c.parent_id AS parent_category_id,
      pc.name AS parent_category,
      t.category_id,
      c.name AS category,
      COALESCE(pc.colour, c.colour) AS colour,
      SUM(t.amount_cents) AS total_cents,
      COUNT(*) AS transaction_count
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE strftime('%Y-%m', t.transaction_date) = ?
      AND t.amount_cents < 0
      AND t.is_transfer = 0
    GROUP BY t.category_id
    ORDER BY SUM(t.amount_cents) ASC
  `).all(month) as MonthlySpendRow[];
}

export function getCategoryTransactions(month: string, categoryId: number): TransactionRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      t.id,
      t.transaction_date,
      t.amount_cents,
      t.description,
      t.merchant,
      t.category_id,
      c.name AS category,
      pc.name AS parent_category,
      a.name AS account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    JOIN accounts a ON t.account_id = a.id
    WHERE strftime('%Y-%m', t.transaction_date) = ?
      AND (t.category_id = ? OR c.parent_id = ?)
      AND t.amount_cents < 0
      AND t.is_transfer = 0
    ORDER BY t.transaction_date DESC, t.id DESC
  `).all(month, categoryId, categoryId) as TransactionRow[];
}

export function getMonthTransactions(month: string): TransactionRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      t.id,
      t.transaction_date,
      t.amount_cents,
      t.description,
      t.merchant,
      t.category_id,
      c.name AS category,
      pc.name AS parent_category,
      a.name AS account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    JOIN accounts a ON t.account_id = a.id
    WHERE strftime('%Y-%m', t.transaction_date) = ?
      AND t.amount_cents < 0
      AND t.is_transfer = 0
    ORDER BY t.transaction_date DESC, t.id DESC
  `).all(month) as TransactionRow[];
}

export function getAllCategories(): CategoryRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      c.id,
      c.name,
      c.parent_id,
      pc.name AS parent_name
    FROM categories c
    LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE c.parent_id IS NOT NULL
    ORDER BY pc.sort_order, pc.name, c.sort_order, c.name
  `).all() as CategoryRow[];
}

export function updateTransactionCategory(transactionId: number, categoryId: number): void {
  const db = getDb();
  const category = db.prepare(`
    SELECT id, parent_id FROM categories WHERE id = ?
  `).get(categoryId) as { id: number; parent_id: number | null } | undefined;

  if (!category) return;

  db.prepare(`
    UPDATE transactions
    SET category_id = ?, parent_category_id = ?, updated_at = unixepoch()
    WHERE id = ?
  `).run(categoryId, category.parent_id, transactionId);
}

export function getOverviewKpis(month: string): OverviewKpis {
  const db = getDb();

  const spend = db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) AS total
    FROM transactions
    WHERE strftime('%Y-%m', transaction_date) = ?
      AND amount_cents < 0
      AND is_transfer = 0
  `).get(month) as { total: number };

  const income = db.prepare(`
    SELECT COALESCE(SUM(amount_cents), 0) AS total
    FROM transactions
    WHERE strftime('%Y-%m', transaction_date) = ?
      AND amount_cents > 0
      AND is_transfer = 0
  `).get(month) as { total: number };

  const count = db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM transactions
    WHERE strftime('%Y-%m', transaction_date) = ?
      AND is_transfer = 0
  `).get(month) as { cnt: number };

  const topCat = db.prepare(`
    SELECT
      COALESCE(pc.name, c.name, 'Uncategorised') AS category,
      ABS(SUM(t.amount_cents)) AS total
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE strftime('%Y-%m', t.transaction_date) = ?
      AND t.amount_cents < 0
      AND t.is_transfer = 0
    GROUP BY COALESCE(pc.name, c.name)
    ORDER BY ABS(SUM(t.amount_cents)) DESC
    LIMIT 1
  `).get(month) as { category: string; total: number } | undefined;

  return {
    totalSpendCents: spend.total,
    totalIncomeCents: income.total,
    transactionCount: count.cnt,
    topCategory: topCat?.category ?? 'None',
    topCategoryCents: topCat?.total ?? 0,
  };
}

export function getCategoryBreakdown(month: string): CategoryBreakdownRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      COALESCE(pc.name, c.name, 'Uncategorised') AS parent_category,
      COALESCE(pc.colour, c.colour, '#9CA3AF') AS colour,
      ABS(SUM(t.amount_cents)) AS total_cents
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE strftime('%Y-%m', t.transaction_date) = ?
      AND t.amount_cents < 0
      AND t.is_transfer = 0
    GROUP BY COALESCE(pc.name, c.name), COALESCE(pc.colour, c.colour)
    ORDER BY total_cents DESC
  `).all(month) as CategoryBreakdownRow[];
}

export function getMonthlyTotals(months: number): MonthlyTotalRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      strftime('%Y-%m', t.transaction_date) AS month,
      ABS(SUM(t.amount_cents)) AS total_cents
    FROM transactions t
    WHERE t.amount_cents < 0
      AND t.is_transfer = 0
      AND t.transaction_date >= date('now', '-' || ? || ' months', 'start of month')
    GROUP BY strftime('%Y-%m', t.transaction_date)
    ORDER BY month
  `).all(months) as MonthlyTotalRow[];
}

export function getRecentTransactions(limit: number): RecentTransactionRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      t.id,
      t.transaction_date,
      t.amount_cents,
      t.description,
      t.merchant,
      c.name AS category,
      pc.name AS parent_category,
      COALESCE(pc.colour, c.colour) AS colour,
      a.name AS account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    JOIN accounts a ON t.account_id = a.id
    WHERE t.is_transfer = 0
    ORDER BY t.transaction_date DESC, t.id DESC
    LIMIT ?
  `).all(limit) as RecentTransactionRow[];
}

export function searchTransactions(params: TransactionSearchParams): TransactionSearchResult {
  const db = getDb();
  const conditions: string[] = ['t.is_transfer = 0'];
  const values: (string | number)[] = [];

  if (params.month) {
    conditions.push("strftime('%Y-%m', t.transaction_date) = ?");
    values.push(params.month);
  }

  if (params.accountId) {
    conditions.push('t.account_id = ?');
    values.push(params.accountId);
  }

  if (params.categoryId) {
    conditions.push('(t.category_id = ? OR c.parent_id = ?)');
    values.push(params.categoryId, params.categoryId);
  }

  if (params.query) {
    conditions.push("(t.description LIKE '%' || ? || '%' OR t.merchant LIKE '%' || ? || '%')");
    values.push(params.query, params.query);
  }

  const where = conditions.join(' AND ');

  const countRow = db.prepare(`
    SELECT COUNT(*) AS cnt
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE ${where}
  `).get(...values) as { cnt: number };

  const offset = (params.page - 1) * params.pageSize;

  const transactions = db.prepare(`
    SELECT
      t.id,
      t.transaction_date,
      t.amount_cents,
      t.description,
      t.merchant,
      t.category_id,
      c.name AS category,
      pc.name AS parent_category,
      a.name AS account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    JOIN accounts a ON t.account_id = a.id
    WHERE ${where}
    ORDER BY t.transaction_date DESC, t.id DESC
    LIMIT ? OFFSET ?
  `).all(...values, params.pageSize, offset) as TransactionRow[];

  return { transactions, total: countRow.cnt };
}

export function getAccounts(): AccountRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT id, name FROM accounts WHERE is_active = 1 ORDER BY name
  `).all() as AccountRow[];
}

export function getCategoryInfo(categoryId: number): CategoryInfo | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      c.id,
      c.name,
      COALESCE(c.colour, pc.colour, '#9CA3AF') AS colour,
      c.parent_id,
      pc.name AS parent_name,
      pc.colour AS parent_colour
    FROM categories c
    LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE c.id = ?
  `).get(categoryId) as CategoryInfo | undefined;
  return row ?? null;
}

export function getCategoryMonthlyTrend(parentCategoryId: number, months: number): CategoryTrendRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      strftime('%Y-%m', t.transaction_date) AS month,
      ABS(SUM(t.amount_cents)) AS total_cents
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE (t.category_id = ? OR c.parent_id = ?)
      AND t.amount_cents < 0
      AND t.is_transfer = 0
      AND t.transaction_date >= date('now', '-' || ? || ' months', 'start of month')
    GROUP BY strftime('%Y-%m', t.transaction_date)
    ORDER BY month
  `).all(parentCategoryId, parentCategoryId, months) as CategoryTrendRow[];
}

export function getSubcategoryBreakdown(parentCategoryId: number, startDate: string, endDate: string): SubcategoryRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      t.category_id,
      COALESCE(c.name, 'Uncategorised') AS category,
      ABS(SUM(t.amount_cents)) AS total_cents
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE (t.category_id = ? OR c.parent_id = ?)
      AND t.amount_cents < 0
      AND t.is_transfer = 0
      AND t.transaction_date >= ?
      AND t.transaction_date < ?
    GROUP BY t.category_id, c.name
    ORDER BY total_cents DESC
  `).all(parentCategoryId, parentCategoryId, startDate, endDate) as SubcategoryRow[];
}

export function getTopMerchants(parentCategoryId: number, startDate: string, endDate: string): MerchantRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      COALESCE(t.merchant, t.description) AS merchant,
      ABS(SUM(t.amount_cents)) AS total_cents,
      COUNT(*) AS transaction_count
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE (t.category_id = ? OR c.parent_id = ?)
      AND t.amount_cents < 0
      AND t.is_transfer = 0
      AND t.transaction_date >= ?
      AND t.transaction_date < ?
    GROUP BY COALESCE(t.merchant, t.description)
    ORDER BY total_cents DESC
    LIMIT 10
  `).all(parentCategoryId, parentCategoryId, startDate, endDate) as MerchantRow[];
}

export function getCategoryDetailTransactions(
  parentCategoryId: number,
  startDate: string,
  endDate: string,
): TransactionRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      t.id,
      t.transaction_date,
      t.amount_cents,
      t.description,
      t.merchant,
      t.category_id,
      c.name AS category,
      pc.name AS parent_category,
      a.name AS account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    JOIN accounts a ON t.account_id = a.id
    WHERE (t.category_id = ? OR c.parent_id = ?)
      AND t.amount_cents < 0
      AND t.is_transfer = 0
      AND t.transaction_date >= ?
      AND t.transaction_date < ?
    ORDER BY t.transaction_date DESC, t.id DESC
  `).all(parentCategoryId, parentCategoryId, startDate, endDate) as TransactionRow[];
}

export function getCategorySpendForMonth(categoryId: number, month: string): number {
  const db = getDb();
  const row = db.prepare(`
    SELECT COALESCE(ABS(SUM(t.amount_cents)), 0) AS total
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE (t.category_id = ? OR c.parent_id = ?)
      AND t.amount_cents < 0
      AND t.is_transfer = 0
      AND strftime('%Y-%m', t.transaction_date) = ?
  `).get(categoryId, categoryId, month) as { total: number };
  return row.total;
}

export function getStackedMonthlyTrend(parentCategoryId: number, months: number): StackedTrendRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      strftime('%Y-%m', t.transaction_date) AS month,
      COALESCE(c.name, 'Uncategorised') AS category,
      ABS(SUM(t.amount_cents)) AS total_cents
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE (t.category_id = ? OR c.parent_id = ?)
      AND t.amount_cents < 0
      AND t.is_transfer = 0
      AND t.transaction_date >= date('now', '-' || ? || ' months', 'start of month')
    GROUP BY strftime('%Y-%m', t.transaction_date), c.name
    ORDER BY month, total_cents DESC
  `).all(parentCategoryId, parentCategoryId, months) as StackedTrendRow[];
}

export function getParentCategories(): ParentCategoryRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT id, name, COALESCE(colour, '#9CA3AF') AS colour
    FROM categories
    WHERE parent_id IS NULL
    ORDER BY sort_order, name
  `).all() as ParentCategoryRow[];
}

export function getChildCategories(parentId: number): ChildCategoryRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT c.id, c.name, c.parent_id, pc.name AS parent_name
    FROM categories c
    JOIN categories pc ON c.parent_id = pc.id
    WHERE c.parent_id = ?
    ORDER BY c.sort_order, c.name
  `).all(parentId) as ChildCategoryRow[];
}

export function getSubcategorySpendForMonth(categoryId: number, month: string): number {
  const db = getDb();
  const row = db.prepare(`
    SELECT COALESCE(ABS(SUM(t.amount_cents)), 0) AS total
    FROM transactions t
    WHERE t.category_id = ?
      AND t.amount_cents < 0
      AND t.is_transfer = 0
      AND strftime('%Y-%m', t.transaction_date) = ?
  `).get(categoryId, month) as { total: number };
  return row.total;
}

export function getSubcategoryMonthlyTrend(categoryId: number, months: number): CategoryTrendRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      strftime('%Y-%m', t.transaction_date) AS month,
      ABS(SUM(t.amount_cents)) AS total_cents
    FROM transactions t
    WHERE t.category_id = ?
      AND t.amount_cents < 0
      AND t.is_transfer = 0
      AND t.transaction_date >= date('now', '-' || ? || ' months', 'start of month')
    GROUP BY strftime('%Y-%m', t.transaction_date)
    ORDER BY month
  `).all(categoryId, months) as CategoryTrendRow[];
}

export function getSubcategoryMerchants(categoryId: number, startDate: string, endDate: string): MerchantRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      COALESCE(t.merchant, t.description) AS merchant,
      ABS(SUM(t.amount_cents)) AS total_cents,
      COUNT(*) AS transaction_count
    FROM transactions t
    WHERE t.category_id = ?
      AND t.amount_cents < 0
      AND t.is_transfer = 0
      AND t.transaction_date >= ?
      AND t.transaction_date < ?
    GROUP BY COALESCE(t.merchant, t.description)
    ORDER BY total_cents DESC
    LIMIT 10
  `).all(categoryId, startDate, endDate) as MerchantRow[];
}

export function getSubcategoryTransactions(
  categoryId: number,
  startDate: string,
  endDate: string,
): TransactionRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      t.id,
      t.transaction_date,
      t.amount_cents,
      t.description,
      t.merchant,
      t.category_id,
      c.name AS category,
      pc.name AS parent_category,
      a.name AS account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    JOIN accounts a ON t.account_id = a.id
    WHERE t.category_id = ?
      AND t.amount_cents < 0
      AND t.is_transfer = 0
      AND t.transaction_date >= ?
      AND t.transaction_date < ?
    ORDER BY t.transaction_date DESC, t.id DESC
  `).all(categoryId, startDate, endDate) as TransactionRow[];
}

// ── Balance Sheet ─────────────────────────────────────────────────────────────

export interface NetWorthSnapshot {
  snapshot_date: string;
  total_assets_cents: number;
  total_liabilities_cents: number;
  net_worth_cents: number;
  cash_cents: number;
  investment_cents: number;
  property_value_cents: number;
  property_equity_cents: number;
  other_assets_cents: number;
  mortgage_cents: number;
  other_liabilities_cents: number;
}

export interface LoanSnapshotRow {
  account_name: string;
  outstanding_cents: number;
  interest_rate: number | null;
  facility_type: string | null;
}

export interface AssetBreakdownRow {
  account_name: string;
  account_type: string;
  balance_cents: number;
}

export function getLatestNetWorthSnapshot(): NetWorthSnapshot | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT * FROM net_worth_snapshots ORDER BY snapshot_date DESC LIMIT 1
  `).get() as NetWorthSnapshot | undefined;
  return row ?? null;
}

export function getNetWorthHistory(): NetWorthSnapshot[] {
  const db = getDb();
  return db.prepare(`
    SELECT * FROM net_worth_snapshots ORDER BY snapshot_date ASC
  `).all() as NetWorthSnapshot[];
}

export function getLatestLoanSnapshots(snapshotDate: string): LoanSnapshotRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      a.name AS account_name,
      ls.outstanding_cents,
      ls.interest_rate,
      ls.facility_type
    FROM loan_snapshots ls
    JOIN accounts a ON ls.account_id = a.id
    WHERE ls.snapshot_date = ?
      AND ls.outstanding_cents > 0
    ORDER BY a.name
  `).all(snapshotDate) as LoanSnapshotRow[];
}

export interface AssetDetailRow {
  account_name: string;
  asset_class: string;
  balance_cents: number;
}

export function getAssetAccountDetails(snapshotDate: string): AssetDetailRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      a.name AS account_name,
      ab.balance_cents,
      CASE a.account_type
        WHEN 'savings'     THEN 'Cash'
        WHEN 'transaction' THEN 'Cash'
        WHEN 'asset'       THEN 'Other'
        ELSE CASE
          WHEN a.institution IN ('CMC Markets', 'IG', 'Moelis', 'Stockland') THEN 'Investments'
          ELSE 'Other'
        END
      END AS asset_class
    FROM account_balances ab
    JOIN accounts a ON ab.account_id = a.id
    WHERE ab.balance_date = ?
      AND a.source = 'manual'
      AND a.account_type NOT IN ('liability', 'mortgage')
      AND ab.balance_cents > 0

    UNION ALL

    SELECT
      a.name AS account_name,
      ast.value_cents AS balance_cents,
      'Property' AS asset_class
    FROM assets ast
    JOIN accounts a ON ast.account_id = a.id
    WHERE ast.valuation_date = ?
      AND ast.value_cents > 0

    ORDER BY asset_class, balance_cents DESC
  `).all(snapshotDate, snapshotDate) as AssetDetailRow[];
}

export function getLatestAssetBreakdown(): AssetBreakdownRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      a.name AS account_name,
      a.account_type,
      ab.balance_cents
    FROM account_balances ab
    JOIN accounts a ON ab.account_id = a.id
    WHERE ab.balance_date = (
      SELECT MAX(ab2.balance_date)
      FROM account_balances ab2
      WHERE ab2.account_id = ab.account_id
    )
      AND a.source = 'manual'
    ORDER BY a.account_type, a.name
  `).all() as AssetBreakdownRow[];
}

export function getPivotData(months: number): PivotRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      COALESCE(c.parent_id, c.id) AS parent_category_id,
      COALESCE(pc.name, c.name, 'Uncategorised') AS parent_category,
      COALESCE(pc.colour, c.colour, '#9CA3AF') AS parent_colour,
      t.category_id AS category_id,
      c.name AS category,
      strftime('%Y-%m', t.transaction_date) AS month,
      ABS(SUM(t.amount_cents)) AS total_cents
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE t.amount_cents < 0
      AND t.is_transfer = 0
      AND t.transaction_date >= date('now', '-' || ? || ' months', 'start of month')
    GROUP BY COALESCE(c.parent_id, c.id), t.category_id, strftime('%Y-%m', t.transaction_date)
    ORDER BY COALESCE(pc.sort_order, c.sort_order, 999), COALESCE(pc.name, c.name), c.sort_order, c.name, month
  `).all(months) as PivotRow[];
}
