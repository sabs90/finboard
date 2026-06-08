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
