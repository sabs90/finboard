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
  is_flagged?: number;
  notes?: string | null;
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
  category_id: number | null;
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
  startDate?: string;
  endDate?: string;
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

export interface SpendIncome {
  spendCents: number;  // negative (outflow)
  incomeCents: number; // positive
}

/**
 * Spend and income within a month, restricted to transactions on or before a
 * given day-of-month. Used for fair month-to-date vs month-to-date comparison.
 */
export function getSpendIncomeUpToDay(month: string, maxDay: number): SpendIncome {
  const db = getDb();
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN amount_cents < 0 THEN amount_cents ELSE 0 END), 0) AS spend,
      COALESCE(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0) AS income
    FROM transactions
    WHERE strftime('%Y-%m', transaction_date) = ?
      AND CAST(strftime('%d', transaction_date) AS INTEGER) <= ?
      AND is_transfer = 0
  `).get(month, maxDay) as { spend: number; income: number };
  return { spendCents: row.spend, incomeCents: row.income };
}

export function getCategoryBreakdown(month: string): CategoryBreakdownRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      COALESCE(pc.name, c.name, 'Uncategorised') AS parent_category,
      COALESCE(pc.id, c.id) AS category_id,
      COALESCE(pc.colour, c.colour, '#9CA3AF') AS colour,
      ABS(SUM(t.amount_cents)) AS total_cents
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE strftime('%Y-%m', t.transaction_date) = ?
      AND t.amount_cents < 0
      AND t.is_transfer = 0
    GROUP BY COALESCE(pc.id, c.id), COALESCE(pc.name, c.name), COALESCE(pc.colour, c.colour)
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

  if (params.startDate) {
    conditions.push('t.transaction_date >= ?');
    values.push(params.startDate);
  }

  if (params.endDate) {
    conditions.push('t.transaction_date <= ?');
    values.push(params.endDate);
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
      a.name AS account_name,
      t.is_flagged,
      t.notes
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

// ── Bulk categorisation grid ──────────────────────────────────────────────────

/**
 * Candidate transactions for the bulk-categorise grid.
 * scope: 'uncategorised' | 'transfers' | 'all' | 'cat:<categoryId>'
 */
export function getCategorisationCandidates(opts: {
  scope: string;
  query?: string;
  limit: number;
}): TransactionRow[] {
  const db = getDb();
  const conditions: string[] = [];
  const values: (string | number)[] = [];

  if (opts.scope === 'uncategorised') {
    conditions.push("t.is_transfer = 0 AND (c.name = 'Uncategorised' OR pc.name = 'Uncategorised' OR t.category_id IS NULL)");
  } else if (opts.scope === 'transfers') {
    conditions.push('t.is_transfer = 1');
  } else if (opts.scope.startsWith('cat:')) {
    const id = parseInt(opts.scope.slice(4), 10);
    if (!isNaN(id)) {
      conditions.push('(t.category_id = ? OR c.parent_id = ?)');
      values.push(id, id);
    }
  }
  // 'all' adds no scope condition.

  if (opts.query) {
    conditions.push("(t.description LIKE '%' || ? || '%' OR t.merchant LIKE '%' || ? || '%')");
    values.push(opts.query, opts.query);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return db.prepare(`
    SELECT
      t.id, t.transaction_date, t.amount_cents, t.description, t.merchant,
      t.category_id, c.name AS category, pc.name AS parent_category, a.name AS account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    JOIN accounts a ON t.account_id = a.id
    ${where}
    ORDER BY t.transaction_date DESC, t.id DESC
    LIMIT ?
  `).all(...values, opts.limit) as TransactionRow[];
}

export interface CategoryTreeNode {
  id: number;
  name: string;
  children: { id: number; name: string }[];
}

/** Full category tree (parents with their children) for dropdowns. */
export function getCategoryTree(): CategoryTreeNode[] {
  const db = getDb();
  const parents = db.prepare(
    `SELECT id, name FROM categories WHERE parent_id IS NULL ORDER BY sort_order, name`
  ).all() as { id: number; name: string }[];
  const children = db.prepare(
    `SELECT id, name, parent_id FROM categories WHERE parent_id IS NOT NULL ORDER BY sort_order, name`
  ).all() as { id: number; name: string; parent_id: number }[];
  return parents.map((p) => ({
    id: p.id,
    name: p.name,
    children: children.filter((c) => c.parent_id === p.id).map((c) => ({ id: c.id, name: c.name })),
  }));
}

export interface CategorisationEdit {
  transactionId: number;
  categoryId: number;   // target category (a child, or a parent for parent-level)
  keyword: string;
}

export interface CategorisationSummary {
  transactionsUpdated: number;
  rulesCreated: number;
  additionalMatched: number;
}

/**
 * Apply a batch of grid edits in one transaction:
 *  - always categorises the specific transaction (one-off)
 *  - if a keyword is given, also creates a description rule and applies it to
 *    every matching transaction (incl. future imports)
 */
export function applyCategorisations(edits: CategorisationEdit[]): CategorisationSummary {
  const db = getDb();
  const run = db.transaction(() => {
    const summary: CategorisationSummary = { transactionsUpdated: 0, rulesCreated: 0, additionalMatched: 0 };

    for (const e of edits) {
      const cat = db.prepare(`
        SELECT c.id, c.parent_id, c.name, pc.name AS parent_name
        FROM categories c LEFT JOIN categories pc ON c.parent_id = pc.id
        WHERE c.id = ?
      `).get(e.categoryId) as { id: number; parent_id: number | null; name: string; parent_name: string | null } | undefined;
      if (!cat) continue;

      const isTransfer = cat.name === 'Money Transfers' && cat.parent_name === 'Transfers' ? 1 : 0;
      const parentCategoryId = cat.parent_id;

      db.prepare(
        `UPDATE transactions SET category_id = ?, parent_category_id = ?, is_transfer = ?, updated_at = unixepoch() WHERE id = ?`
      ).run(cat.id, parentCategoryId, isTransfer, e.transactionId);
      summary.transactionsUpdated += 1;

      const keyword = e.keyword.trim().toLowerCase();
      if (keyword) {
        db.prepare(`
          INSERT INTO category_rules (rule_type, pattern, category_id, is_transfer, source, created_at, updated_at)
          VALUES ('description', ?, ?, ?, 'manual', unixepoch(), unixepoch())
          ON CONFLICT(rule_type, pattern) DO UPDATE SET
            category_id = excluded.category_id, is_transfer = excluded.is_transfer, updated_at = unixepoch()
        `).run(keyword, cat.id, isTransfer);
        summary.rulesCreated += 1;

        const changes = db.prepare(
          `UPDATE transactions SET category_id = ?, parent_category_id = ?, is_transfer = ?, updated_at = unixepoch()
           WHERE LOWER(description) LIKE '%' || ? || '%'`
        ).run(cat.id, parentCategoryId, isTransfer, keyword).changes;
        summary.additionalMatched += changes;
      }
    }
    return summary;
  });
  return run();
}

// ── Category rules ────────────────────────────────────────────────────────────

export type RuleType = 'merchant' | 'description';

export interface CategoryRuleRow {
  id: number;
  rule_type: RuleType;
  pattern: string;
  category_id: number;
  category: string;
  parent_category: string | null;
  colour: string;
  is_transfer: number;
}

export function getCategoryRules(): CategoryRuleRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      r.id, r.rule_type, r.pattern, r.category_id, r.is_transfer,
      c.name AS category,
      pc.name AS parent_category,
      COALESCE(pc.colour, c.colour, '#9CA3AF') AS colour
    FROM category_rules r
    JOIN categories c ON r.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    ORDER BY r.rule_type, r.pattern
  `).all() as CategoryRuleRow[];
}

/** Count transactions a rule would match (for preview before applying). */
export function countRuleMatches(ruleType: RuleType, pattern: string): number {
  const db = getDb();
  const p = pattern.trim();
  if (!p) return 0;
  if (ruleType === 'description') {
    const row = db.prepare(
      `SELECT COUNT(*) AS n FROM transactions WHERE LOWER(description) LIKE '%' || ? || '%'`
    ).get(p.toLowerCase()) as { n: number };
    return row.n;
  }
  const row = db.prepare(`SELECT COUNT(*) AS n FROM transactions WHERE merchant = ?`).get(p) as { n: number };
  return row.n;
}

/**
 * Create (or update) a rule and apply it to ALL matching transactions.
 * Returns the number of transactions updated.
 */
export function createCategoryRule(ruleType: RuleType, pattern: string, categoryId: number): { affected: number } {
  const db = getDb();
  const cat = db.prepare(`
    SELECT c.id, c.parent_id, c.name, pc.name AS parent_name
    FROM categories c LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE c.id = ?
  `).get(categoryId) as { id: number; parent_id: number | null; name: string; parent_name: string | null } | undefined;
  if (!cat) return { affected: 0 };

  const storedPattern = ruleType === 'description' ? pattern.trim().toLowerCase() : pattern.trim();
  if (!storedPattern) return { affected: 0 };

  const isTransfer = cat.name === 'Money Transfers' && cat.parent_name === 'Transfers' ? 1 : 0;
  const parentCategoryId = cat.parent_id;

  const apply = db.transaction(() => {
    db.prepare(`
      INSERT INTO category_rules (rule_type, pattern, category_id, is_transfer, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'manual', unixepoch(), unixepoch())
      ON CONFLICT(rule_type, pattern) DO UPDATE SET
        category_id = excluded.category_id,
        is_transfer = excluded.is_transfer,
        updated_at = unixepoch()
    `).run(ruleType, storedPattern, categoryId, isTransfer);

    const sql = ruleType === 'description'
      ? `UPDATE transactions SET category_id = ?, parent_category_id = ?, is_transfer = ?, updated_at = unixepoch()
         WHERE LOWER(description) LIKE '%' || ? || '%'`
      : `UPDATE transactions SET category_id = ?, parent_category_id = ?, is_transfer = ?, updated_at = unixepoch()
         WHERE merchant = ?`;
    return db.prepare(sql).run(categoryId, parentCategoryId, isTransfer, storedPattern).changes;
  });

  return { affected: apply() };
}

export function deleteCategoryRule(id: number): void {
  const db = getDb();
  db.prepare(`DELETE FROM category_rules WHERE id = ?`).run(id);
}

export interface DataFreshness {
  latestTransaction: string | null;
  transactionCount: number;
}

export function getDataFreshness(): DataFreshness {
  const db = getDb();
  const row = db.prepare(`
    SELECT MAX(transaction_date) AS latest, COUNT(*) AS cnt FROM transactions
  `).get() as { latest: string | null; cnt: number };
  return { latestTransaction: row.latest, transactionCount: row.cnt };
}

export function updateTransactionFlag(transactionId: number, flagged: boolean): void {
  const db = getDb();
  db.prepare(`
    UPDATE transactions SET is_flagged = ?, updated_at = unixepoch() WHERE id = ?
  `).run(flagged ? 1 : 0, transactionId);
}

export function updateTransactionNote(transactionId: number, note: string): void {
  const db = getDb();
  const trimmed = note.trim();
  db.prepare(`
    UPDATE transactions SET notes = ?, updated_at = unixepoch() WHERE id = ?
  `).run(trimmed.length > 0 ? trimmed : null, transactionId);
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

export interface HistoricalBalancePoint {
  account_name: string;
  category: string;
  sort_key: number;
  balance_date: string;
  balance_cents: number;
}

export function getHistoricalAccountBalances(): HistoricalBalancePoint[] {
  const db = getDb();
  return db.prepare(`
    SELECT account_name, category, sort_key, balance_date, balance_cents FROM (

      SELECT
        a.name AS account_name,
        CASE a.account_type
          WHEN 'savings'     THEN 'Cash'
          WHEN 'transaction' THEN 'Cash'
          WHEN 'asset'       THEN 'Other'
          WHEN 'liability'   THEN 'Other Liabilities'
          ELSE CASE
            WHEN a.institution IN ('CMC Markets', 'IG', 'Moelis', 'Stockland') THEN 'Investments'
            ELSE 'Other'
          END
        END AS category,
        CASE a.account_type
          WHEN 'savings'     THEN 1
          WHEN 'transaction' THEN 1
          WHEN 'asset'       THEN 3
          WHEN 'liability'   THEN 5
          ELSE CASE
            WHEN a.institution IN ('CMC Markets', 'IG', 'Moelis', 'Stockland') THEN 2
            ELSE 3
          END
        END AS sort_key,
        ab.balance_date,
        ab.balance_cents
      FROM account_balances ab
      JOIN accounts a ON ab.account_id = a.id
      WHERE a.source = 'manual'
        AND a.account_type != 'mortgage'

      UNION ALL

      SELECT
        a.name AS account_name,
        'Property' AS category,
        2 AS sort_key,
        ast.valuation_date AS balance_date,
        ast.value_cents AS balance_cents
      FROM assets ast
      JOIN accounts a ON ast.account_id = a.id

      UNION ALL

      SELECT
        a.name AS account_name,
        'Mortgages' AS category,
        4 AS sort_key,
        ls.snapshot_date AS balance_date,
        ls.outstanding_cents AS balance_cents
      FROM loan_snapshots ls
      JOIN accounts a ON ls.account_id = a.id

    )
    ORDER BY sort_key, account_name, balance_date
  `).all() as HistoricalBalancePoint[];
}

// ── Balance Sheet input ───────────────────────────────────────────────────────

// Institutions whose 'investment' accounts count as Investments (vs Other).
// Mirrors scripts/ingest_balance_sheet.py and getAssetAccountDetails above.
const INVESTMENT_INSTITUTIONS = ['CMC Markets', 'IG', 'Moelis', 'Stockland'];

export type BalanceGroup = 'Cash' | 'Investments' | 'Other' | 'Property' | 'Liabilities' | 'Mortgages';

export interface BalanceInputAccount {
  account_id: number;
  name: string;
  kind: 'balance' | 'asset' | 'loan';
  group: BalanceGroup;
  prev_cents: number | null;
  prev_date: string | null;
  facility_type: string | null; // loans only
  prev_rate: number | null;     // loans only (decimal, e.g. 0.0619)
}

export function getLatestSnapshotDate(): string | null {
  const db = getDb();
  const row = db.prepare(
    `SELECT MAX(snapshot_date) AS d FROM net_worth_snapshots`
  ).get() as { d: string | null };
  return row.d ?? null;
}

/**
 * Every manually-tracked balance-sheet line item with its most recent value,
 * grouped for the balance-sheet input page. Accounts in account_balances
 * (cash / investments / vehicles / crypto / credit cards), property (assets)
 * and mortgages (loan_snapshots) are all returned in one ordered list.
 */
export function getBalanceInputAccounts(): BalanceInputAccount[] {
  const db = getDb();

  const balanceAccts = db.prepare(`
    SELECT a.id AS account_id, a.name, a.account_type, a.institution,
           ab.balance_cents AS prev_cents, ab.balance_date AS prev_date
    FROM accounts a
    LEFT JOIN account_balances ab ON ab.account_id = a.id
      AND ab.balance_date = (SELECT MAX(balance_date) FROM account_balances WHERE account_id = a.id)
    WHERE a.source = 'manual'
      AND a.account_type IN ('savings', 'transaction', 'investment', 'asset', 'liability')
    ORDER BY a.name
  `).all() as {
    account_id: number; name: string; account_type: string; institution: string;
    prev_cents: number | null; prev_date: string | null;
  }[];

  const balances: BalanceInputAccount[] = balanceAccts.map((a) => {
    let group: BalanceGroup;
    if (a.account_type === 'savings' || a.account_type === 'transaction') group = 'Cash';
    else if (a.account_type === 'liability') group = 'Liabilities';
    else if (a.account_type === 'investment' && INVESTMENT_INSTITUTIONS.includes(a.institution)) group = 'Investments';
    else group = 'Other';
    return {
      account_id: a.account_id, name: a.name, kind: 'balance', group,
      prev_cents: a.prev_cents, prev_date: a.prev_date, facility_type: null, prev_rate: null,
    };
  });

  const property = db.prepare(`
    SELECT a.id AS account_id, a.name,
           ast.value_cents AS prev_cents, ast.valuation_date AS prev_date
    FROM accounts a
    LEFT JOIN assets ast ON ast.account_id = a.id
      AND ast.valuation_date = (SELECT MAX(valuation_date) FROM assets WHERE account_id = a.id)
    WHERE a.source = 'manual' AND a.account_type = 'property'
    ORDER BY a.name
  `).all() as { account_id: number; name: string; prev_cents: number | null; prev_date: string | null }[];

  const propertyRows: BalanceInputAccount[] = property.map((p) => ({
    account_id: p.account_id, name: p.name, kind: 'asset', group: 'Property',
    prev_cents: p.prev_cents, prev_date: p.prev_date, facility_type: null, prev_rate: null,
  }));

  const loans = db.prepare(`
    SELECT a.id AS account_id, a.name,
           ls.outstanding_cents AS prev_cents, ls.snapshot_date AS prev_date,
           ls.interest_rate AS prev_rate, ls.facility_type
    FROM accounts a
    LEFT JOIN loan_snapshots ls ON ls.account_id = a.id
      AND ls.snapshot_date = (SELECT MAX(snapshot_date) FROM loan_snapshots WHERE account_id = a.id)
    WHERE a.source = 'manual' AND a.account_type = 'mortgage'
    ORDER BY a.name
  `).all() as {
    account_id: number; name: string; prev_cents: number | null; prev_date: string | null;
    prev_rate: number | null; facility_type: string | null;
  }[];

  const loanRows: BalanceInputAccount[] = loans.map((l) => ({
    account_id: l.account_id, name: l.name, kind: 'loan', group: 'Mortgages',
    prev_cents: l.prev_cents, prev_date: l.prev_date,
    facility_type: l.facility_type, prev_rate: l.prev_rate,
  }));

  return [...balances, ...propertyRows, ...loanRows];
}

export interface BalanceEntry {
  account_id: number;
  kind: 'balance' | 'asset' | 'loan';
  cents: number;
  rate?: number | null; // loans only, decimal
}

/**
 * Recompute the net_worth_snapshots row for a date by carry-forward summing
 * the most recent value (on or before that date) of every manual line item.
 * Classification mirrors scripts/ingest_balance_sheet.py exactly.
 */
function recomputeNetWorthSnapshot(db: Database.Database, date: string): void {
  const sumAsOf = (sql: string): number =>
    (db.prepare(sql).get(date) as { total: number }).total;

  const cash = sumAsOf(`
    SELECT COALESCE(SUM((
      SELECT ab.balance_cents FROM account_balances ab
      WHERE ab.account_id = a.id AND ab.balance_date <= ?
      ORDER BY ab.balance_date DESC LIMIT 1
    )), 0) AS total
    FROM accounts a
    WHERE a.source = 'manual' AND a.account_type IN ('savings', 'transaction')
  `);

  const investment = sumAsOf(`
    SELECT COALESCE(SUM((
      SELECT ab.balance_cents FROM account_balances ab
      WHERE ab.account_id = a.id AND ab.balance_date <= ?
      ORDER BY ab.balance_date DESC LIMIT 1
    )), 0) AS total
    FROM accounts a
    WHERE a.source = 'manual' AND a.account_type = 'investment'
      AND a.institution IN ('CMC Markets', 'IG', 'Moelis', 'Stockland')
  `);

  const otherInvest = sumAsOf(`
    SELECT COALESCE(SUM((
      SELECT ab.balance_cents FROM account_balances ab
      WHERE ab.account_id = a.id AND ab.balance_date <= ?
      ORDER BY ab.balance_date DESC LIMIT 1
    )), 0) AS total
    FROM accounts a
    WHERE a.source = 'manual' AND a.account_type = 'investment'
      AND a.institution NOT IN ('CMC Markets', 'IG', 'Moelis', 'Stockland')
  `);

  const vehicles = sumAsOf(`
    SELECT COALESCE(SUM((
      SELECT ab.balance_cents FROM account_balances ab
      WHERE ab.account_id = a.id AND ab.balance_date <= ?
      ORDER BY ab.balance_date DESC LIMIT 1
    )), 0) AS total
    FROM accounts a
    WHERE a.source = 'manual' AND a.account_type = 'asset'
  `);

  const otherLiab = sumAsOf(`
    SELECT COALESCE(SUM((
      SELECT ab.balance_cents FROM account_balances ab
      WHERE ab.account_id = a.id AND ab.balance_date <= ?
      ORDER BY ab.balance_date DESC LIMIT 1
    )), 0) AS total
    FROM accounts a
    WHERE a.source = 'manual' AND a.account_type = 'liability'
  `);

  const property = sumAsOf(`
    SELECT COALESCE(SUM((
      SELECT ast.value_cents FROM assets ast
      WHERE ast.account_id = a.id AND ast.valuation_date <= ?
      ORDER BY ast.valuation_date DESC LIMIT 1
    )), 0) AS total
    FROM accounts a
    WHERE a.source = 'manual' AND a.account_type = 'property'
  `);

  const mortgage = sumAsOf(`
    SELECT COALESCE(SUM((
      SELECT ls.outstanding_cents FROM loan_snapshots ls
      WHERE ls.account_id = a.id AND ls.snapshot_date <= ?
      ORDER BY ls.snapshot_date DESC LIMIT 1
    )), 0) AS total
    FROM accounts a
    WHERE a.source = 'manual' AND a.account_type = 'mortgage'
  `);

  const otherAssets = vehicles + otherInvest;
  const totalAssets = cash + investment + property + otherAssets;
  const totalLiab = mortgage + otherLiab;
  const netWorth = totalAssets - totalLiab;
  const propertyEquity = property - mortgage;

  db.prepare(`
    INSERT INTO net_worth_snapshots
      (snapshot_date, total_assets_cents, total_liabilities_cents, net_worth_cents,
       cash_cents, investment_cents, property_value_cents, property_equity_cents,
       other_assets_cents, mortgage_cents, other_liabilities_cents, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT(snapshot_date) DO UPDATE SET
      total_assets_cents      = excluded.total_assets_cents,
      total_liabilities_cents = excluded.total_liabilities_cents,
      net_worth_cents         = excluded.net_worth_cents,
      cash_cents              = excluded.cash_cents,
      investment_cents        = excluded.investment_cents,
      property_value_cents    = excluded.property_value_cents,
      property_equity_cents   = excluded.property_equity_cents,
      other_assets_cents      = excluded.other_assets_cents,
      mortgage_cents          = excluded.mortgage_cents,
      other_liabilities_cents = excluded.other_liabilities_cents
  `).run(
    date, totalAssets, totalLiab, netWorth,
    cash, investment, property, propertyEquity,
    otherAssets, mortgage, otherLiab,
  );
}

export interface SaveBalanceResult {
  date: string;
  accountsUpdated: number;
  netWorthCents: number;
}

/**
 * Persist a set of balance-sheet values for a quarter-end date, then recompute
 * the net worth snapshot. Each entry writes to the table appropriate to its
 * kind (balance → account_balances, asset → assets, loan → loan_snapshots).
 * Idempotent: re-saving the same date overwrites that date's values.
 */
export function saveBalanceSnapshot(date: string, entries: BalanceEntry[]): SaveBalanceResult {
  const db = getDb();
  const run = db.transaction(() => {
    let count = 0;
    for (const e of entries) {
      if (e.kind === 'balance') {
        db.prepare(`
          INSERT INTO account_balances (account_id, balance_date, balance_cents, source, created_at)
          VALUES (?, ?, ?, 'manual', unixepoch())
          ON CONFLICT(account_id, balance_date) DO UPDATE SET balance_cents = excluded.balance_cents
        `).run(e.account_id, date, e.cents);
      } else if (e.kind === 'asset') {
        // assets has no unique index on (account_id, valuation_date) — upsert manually
        const existing = db.prepare(
          `SELECT id FROM assets WHERE account_id = ? AND valuation_date = ?`
        ).get(e.account_id, date) as { id: number } | undefined;
        if (existing) {
          db.prepare(`UPDATE assets SET value_cents = ? WHERE id = ?`).run(e.cents, existing.id);
        } else {
          db.prepare(`
            INSERT INTO assets (account_id, valuation_date, value_cents, source, created_at)
            VALUES (?, ?, ?, 'manual', unixepoch())
          `).run(e.account_id, date, e.cents);
        }
      } else {
        const facility = db.prepare(
          `SELECT facility_type FROM loan_snapshots WHERE account_id = ?
           ORDER BY snapshot_date DESC LIMIT 1`
        ).get(e.account_id) as { facility_type: string | null } | undefined;
        db.prepare(`
          INSERT INTO loan_snapshots
            (account_id, snapshot_date, outstanding_cents, interest_rate, facility_type, source, created_at)
          VALUES (?, ?, ?, ?, ?, 'manual', unixepoch())
          ON CONFLICT(account_id, snapshot_date) DO UPDATE SET
            outstanding_cents = excluded.outstanding_cents,
            interest_rate = COALESCE(excluded.interest_rate, loan_snapshots.interest_rate),
            facility_type = excluded.facility_type
        `).run(e.account_id, date, e.cents, e.rate ?? null, facility?.facility_type ?? null);
      }
      count += 1;
    }

    recomputeNetWorthSnapshot(db, date);
    const snap = db.prepare(
      `SELECT net_worth_cents FROM net_worth_snapshots WHERE snapshot_date = ?`
    ).get(date) as { net_worth_cents: number };
    return { date, accountsUpdated: count, netWorthCents: snap.net_worth_cents };
  });
  return run();
}

// ── Cash Flow ───────────────────────────────────────────────────────────────

export interface CashflowRow {
  month: string;
  income_cents: number;
  expense_cents: number;
  net_cents: number;
}

export function getCashflow(months: number): CashflowRow[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      strftime('%Y-%m', t.transaction_date) AS month,
      COALESCE(SUM(CASE WHEN t.amount_cents > 0 THEN t.amount_cents ELSE 0 END), 0) AS income_cents,
      COALESCE(SUM(CASE WHEN t.amount_cents < 0 THEN -t.amount_cents ELSE 0 END), 0) AS expense_cents
    FROM transactions t
    WHERE t.is_transfer = 0
      AND t.transaction_date >= date('now', '-' || ? || ' months', 'start of month')
    GROUP BY strftime('%Y-%m', t.transaction_date)
    ORDER BY month
  `).all(months) as { month: string; income_cents: number; expense_cents: number }[];
  return rows.map((r) => ({ ...r, net_cents: r.income_cents - r.expense_cents }));
}

// ── Budgets ─────────────────────────────────────────────────────────────────

export interface BudgetRow {
  category_id: number;
  category: string;
  parent_id: number;
  parent_category: string;
  colour: string;
  budget_cents: number;
  spent_cents: number;
  avg6_cents: number;
}

/**
 * Every expense child category with its budget (0 if unset), actual spend for
 * the given month, and average monthly spend over the 6 months preceding the
 * selected month (a baseline for setting budgets). Income and Transfers parents
 * are excluded — budgets only apply to expenses.
 */
export function getBudgetRows(month: string): BudgetRow[] {
  const db = getDb();
  return db.prepare(`
    SELECT
      c.id AS category_id,
      c.name AS category,
      c.parent_id,
      pc.name AS parent_category,
      COALESCE(pc.colour, c.colour, '#9CA3AF') AS colour,
      COALESCE(b.amount_cents, 0) AS budget_cents,
      COALESCE(spend.spent_cents, 0) AS spent_cents,
      COALESCE(avg6.avg6_cents, 0) AS avg6_cents
    FROM categories c
    JOIN categories pc ON c.parent_id = pc.id
    LEFT JOIN budgets b ON b.category_id = c.id AND b.month = ?
    LEFT JOIN (
      SELECT category_id, ABS(SUM(amount_cents)) AS spent_cents
      FROM transactions
      WHERE strftime('%Y-%m', transaction_date) = ?
        AND amount_cents < 0
        AND is_transfer = 0
      GROUP BY category_id
    ) spend ON spend.category_id = c.id
    LEFT JOIN (
      SELECT category_id, ABS(SUM(amount_cents)) / 6 AS avg6_cents
      FROM transactions
      WHERE transaction_date >= date(? || '-01', '-6 months')
        AND transaction_date < date(? || '-01')
        AND amount_cents < 0
        AND is_transfer = 0
      GROUP BY category_id
    ) avg6 ON avg6.category_id = c.id
    WHERE c.parent_id IS NOT NULL
      AND pc.name NOT IN ('Income', 'Transfers')
    ORDER BY pc.sort_order, pc.name, c.sort_order, c.name
  `).all(month, month, month, month) as BudgetRow[];
}

/** Upsert a budget amount for a category in a month. 0 deletes the row. */
export function upsertBudget(categoryId: number, month: string, amountCents: number): void {
  const db = getDb();
  if (amountCents <= 0) {
    db.prepare(`DELETE FROM budgets WHERE category_id = ? AND month = ?`).run(categoryId, month);
    return;
  }
  db.prepare(`
    INSERT INTO budgets (category_id, month, amount_cents, created_at, updated_at)
    VALUES (?, ?, ?, unixepoch(), unixepoch())
    ON CONFLICT(category_id, month) DO UPDATE SET
      amount_cents = excluded.amount_cents,
      updated_at = unixepoch()
  `).run(categoryId, month, amountCents);
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
