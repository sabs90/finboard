"""
Initialise the Finboard SQLite database.

Creates all tables, indexes, and views, then seeds the category hierarchy.
Safe to re-run — uses IF NOT EXISTS throughout.

Usage:
    python scripts/db_init.py
"""

import json
import sqlite3
import sys
import time
from pathlib import Path

# Allow running from the repo root or the scripts/ directory
sys.path.insert(0, str(Path(__file__).parent))

from utils.db import get_connection, transaction
from utils.logger import get_logger

logger = get_logger("db_init")

DDL = """
-- ── accounts ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    institution     TEXT NOT NULL,
    account_type    TEXT NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'AUD',
    is_active       INTEGER NOT NULL DEFAULT 1,
    source          TEXT NOT NULL,
    external_id     TEXT,
    created_at      INTEGER NOT NULL,
    notes           TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_external
    ON accounts(source, external_id)
    WHERE external_id IS NOT NULL;

-- ── categories ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    parent_id   INTEGER REFERENCES categories(id),
    emoji       TEXT,
    colour      TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_name_parent
    ON categories(name, COALESCE(parent_id, 0));

-- ── transactions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id          INTEGER NOT NULL REFERENCES accounts(id),
    transaction_date    TEXT NOT NULL,
    posted_date         TEXT,
    amount_cents        INTEGER NOT NULL,
    description         TEXT NOT NULL,
    merchant            TEXT,
    category_id         INTEGER REFERENCES categories(id),
    parent_category_id  INTEGER REFERENCES categories(id),
    is_transfer         INTEGER NOT NULL DEFAULT 0,
    is_pending          INTEGER NOT NULL DEFAULT 0,
    is_flagged          INTEGER NOT NULL DEFAULT 0,
    notes               TEXT,
    tags                TEXT,
    source              TEXT NOT NULL,
    source_id           TEXT,
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_dedup
    ON transactions(account_id, transaction_date, amount_cents, description)
    WHERE source = 'frollo';

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_dedup_amp
    ON transactions(account_id, transaction_date, amount_cents, description)
    WHERE source = 'amp';

CREATE INDEX IF NOT EXISTS idx_transactions_date     ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_account  ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

-- ── budgets ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id     INTEGER NOT NULL REFERENCES categories(id),
    month           TEXT NOT NULL,
    amount_cents    INTEGER NOT NULL,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_budgets_category_month
    ON budgets(category_id, month);

-- ── assets ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL REFERENCES accounts(id),
    valuation_date  TEXT NOT NULL,
    value_cents     INTEGER NOT NULL,
    source          TEXT NOT NULL,
    notes           TEXT,
    created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assets_account_date
    ON assets(account_id, valuation_date);

-- ── portfolio_positions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolio_positions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL REFERENCES accounts(id),
    sync_date       TEXT NOT NULL,
    symbol          TEXT NOT NULL,
    name            TEXT,
    quantity        REAL NOT NULL,
    market_price    INTEGER NOT NULL,
    market_value    INTEGER NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'AUD',
    created_at      INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_position
    ON portfolio_positions(account_id, sync_date, symbol);

CREATE INDEX IF NOT EXISTS idx_portfolio_date
    ON portfolio_positions(sync_date);

-- ── account_balances ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_balances (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL REFERENCES accounts(id),
    balance_date    TEXT NOT NULL,
    balance_cents   INTEGER NOT NULL,
    source          TEXT NOT NULL DEFAULT 'manual',
    created_at      INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_balances ON account_balances(account_id, balance_date);

-- ── loan_snapshots ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loan_snapshots (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id          INTEGER NOT NULL REFERENCES accounts(id),
    snapshot_date       TEXT NOT NULL,
    outstanding_cents   INTEGER NOT NULL,
    interest_rate       REAL,
    facility_type       TEXT,
    source              TEXT NOT NULL DEFAULT 'manual',
    created_at          INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_snapshots ON loan_snapshots(account_id, snapshot_date);

-- ── net_worth_snapshots ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS net_worth_snapshots (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date               TEXT NOT NULL UNIQUE,
    total_assets_cents          INTEGER NOT NULL,
    total_liabilities_cents     INTEGER NOT NULL,
    net_worth_cents             INTEGER NOT NULL,
    cash_cents                  INTEGER NOT NULL DEFAULT 0,
    investment_cents            INTEGER NOT NULL DEFAULT 0,
    property_value_cents        INTEGER NOT NULL DEFAULT 0,
    property_equity_cents       INTEGER NOT NULL DEFAULT 0,
    super_cents                 INTEGER NOT NULL DEFAULT 0,
    other_assets_cents          INTEGER NOT NULL DEFAULT 0,
    mortgage_cents              INTEGER NOT NULL DEFAULT 0,
    other_liabilities_cents     INTEGER NOT NULL DEFAULT 0,
    created_at                  INTEGER NOT NULL
);

-- ── category_rules ────────────────────────────────────────────────────────────
-- Single source of truth for automatic categorisation. Replaces the JSON rule
-- files (config/merchant_rules.json, config/description_rules.json), which are
-- migrated in via scripts/migrate_rules_to_db.py. Read by the ingest scripts and
-- maintained from the dashboard /rules page.
CREATE TABLE IF NOT EXISTS category_rules (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    rule_type       TEXT NOT NULL,              -- 'merchant' (exact) | 'description' (keyword substring)
    pattern         TEXT NOT NULL,              -- merchant name, or keyword (lowercase) for description
    category_id     INTEGER NOT NULL REFERENCES categories(id),
    is_transfer     INTEGER NOT NULL DEFAULT 0,
    source          TEXT NOT NULL DEFAULT 'manual',
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_category_rules ON category_rules(rule_type, pattern);

-- Recurring/subscription series the user has dismissed (e.g. cancelled or
-- expired). Recurring series are *detected* from transactions at read time
-- (dashboard getRecurring); this table just suppresses a merchant from that
-- list. Soft + reversible — it never touches the underlying transactions.
CREATE TABLE IF NOT EXISTS recurring_dismissals (
    merchant        TEXT PRIMARY KEY,
    created_at      INTEGER NOT NULL
);

-- Singleton net-worth goal (the dashboard's flexible target: FIRE number, a
-- round net-worth figure, etc.). One row max, id fixed at 1.
CREATE TABLE IF NOT EXISTS net_worth_goal (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    label           TEXT NOT NULL DEFAULT 'Net worth goal',
    target_cents    INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

-- Life/finance milestones annotated on the net-worth history chart
-- (e.g. "granny flat complete", "Zeekr delivered").
CREATE TABLE IF NOT EXISTS net_worth_milestones (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    milestone_date  TEXT NOT NULL,      -- YYYY-MM-DD
    label           TEXT NOT NULL,
    created_at      INTEGER NOT NULL
);

-- Singleton PPOR mortgage config for the /mortgage page: which loan accounts
-- form the facility, the linked offset account, and the rate/repayment used
-- in payoff projections. Seeded lazily by the dashboard from live data.
CREATE TABLE IF NOT EXISTS mortgage_settings (
    id                      INTEGER PRIMARY KEY CHECK (id = 1),
    label                   TEXT NOT NULL DEFAULT 'Home Loan',
    loan_account_ids        TEXT NOT NULL,      -- comma-separated accounts.id list
    offset_account_id       INTEGER REFERENCES accounts(id),
    annual_rate             REAL,               -- decimal, e.g. 0.0644
    monthly_repayment_cents INTEGER,
    updated_at              INTEGER NOT NULL
);

-- ── views ─────────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS v_monthly_spend;
CREATE VIEW v_monthly_spend AS
SELECT
    strftime('%Y-%m', t.transaction_date) AS month,
    c.parent_id,
    pc.name AS parent_category,
    t.category_id,
    c.name AS category,
    c.colour,
    SUM(t.amount_cents) AS total_cents,
    COUNT(*) AS transaction_count
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN categories pc ON c.parent_id = pc.id
WHERE t.amount_cents < 0
  AND t.is_transfer = 0
  AND (t.is_pending = 0 OR t.posted_date IS NOT NULL)
GROUP BY 1, 2, 3, 4, 5, 6;

DROP VIEW IF EXISTS v_budget_vs_actual;
CREATE VIEW v_budget_vs_actual AS
SELECT
    b.month,
    b.category_id,
    c.name AS category,
    pc.name AS parent_category,
    c.colour,
    b.amount_cents AS budget_cents,
    COALESCE(ABS(ms.total_cents), 0) AS spent_cents,
    b.amount_cents - COALESCE(ABS(ms.total_cents), 0) AS remaining_cents,
    ROUND(CAST(COALESCE(ABS(ms.total_cents), 0) AS REAL) / b.amount_cents * 100, 1) AS pct_used
FROM budgets b
JOIN categories c ON b.category_id = c.id
LEFT JOIN categories pc ON c.parent_id = pc.id
LEFT JOIN v_monthly_spend ms ON ms.month = b.month AND ms.category_id = b.category_id;

DROP VIEW IF EXISTS v_monthly_income;
CREATE VIEW v_monthly_income AS
SELECT
    strftime('%Y-%m', t.transaction_date) AS month,
    SUM(t.amount_cents) AS total_cents,
    COUNT(*) AS transaction_count
FROM transactions t
JOIN accounts a ON t.account_id = a.id
WHERE t.amount_cents > 0
  AND t.is_transfer = 0
  AND a.account_type IN ('transaction', 'savings')
GROUP BY 1;
"""

# Top-level categories in display order
TOP_LEVEL_CATEGORIES = [
    {"name": "Income",        "emoji": "💰", "colour": "#22C55E", "sort_order": 1},
    {"name": "Housing",       "emoji": "🏠", "colour": "#8B5CF6", "sort_order": 2},
    {"name": "Food & Drink",  "emoji": "🍔", "colour": "#F59E0B", "sort_order": 3},
    {"name": "Transport",     "emoji": "🚗", "colour": "#3B82F6", "sort_order": 4},
    {"name": "Health",        "emoji": "❤️",  "colour": "#EF4444", "sort_order": 5},
    {"name": "Utilities",     "emoji": "⚡", "colour": "#06B6D4", "sort_order": 6},
    {"name": "Entertainment", "emoji": "🎬", "colour": "#EC4899", "sort_order": 7},
    {"name": "Shopping",      "emoji": "🛍️", "colour": "#F97316", "sort_order": 8},
    {"name": "Travel",        "emoji": "✈️",  "colour": "#14B8A6", "sort_order": 9},
    {"name": "Education",     "emoji": "📚", "colour": "#6366F1", "sort_order": 10},
    {"name": "Financial",     "emoji": "🏦", "colour": "#64748B", "sort_order": 11},
    {"name": "Investments",   "emoji": "📈", "colour": "#10B981", "sort_order": 12},
    {"name": "Transfers",     "emoji": "🔄", "colour": "#94A3B8", "sort_order": 13},
    {"name": "Uncategorised", "emoji": "❓", "colour": "#9CA3AF", "sort_order": 14},
]

# Child categories: {parent_name: [child_name, ...]}
CHILD_CATEGORIES: dict[str, list[str]] = {
    "Income": ["Salary", "Interest", "Dividends", "Rental Income", "Government", "Tax Return", "Refund", "Other"],
    "Housing": ["Rent/Mortgage", "Rates", "Strata", "Insurance", "Maintenance"],
    "Food & Drink": ["Groceries", "Restaurants", "Coffee", "Alcohol", "Takeaway"],
    "Transport": ["Fuel", "Parking", "Public Transport", "Rideshare", "Tolls", "Rego & Insurance"],
    "Health": ["GP / Medical", "Pharmacy", "Gym", "Dental", "Optical"],
    "Utilities": ["Electricity", "Gas", "Water", "Internet", "Mobile"],
    "Entertainment": ["Subscriptions", "Entertainment", "Gaming"],
    "Shopping": ["Clothing", "Electronics", "Personal Care", "Gifts", "General"],
    "Travel": ["Flights", "Accommodation", "General Travel"],
    "Education": ["General"],
    "Financial": ["Bank Fees", "Insurance", "Loan Repayments", "Credit Card Payments", "Tax", "Professional Services"],
    "Investments": [],
    "Transfers": [],
    "Uncategorised": [],
}


def seed_categories(conn: sqlite3.Connection) -> None:
    """Insert top-level and child categories, skipping existing rows."""
    now = int(time.time())
    inserted_parents = 0
    inserted_children = 0

    for cat in TOP_LEVEL_CATEGORIES:
        try:
            conn.execute(
                """
                INSERT INTO categories (name, parent_id, emoji, colour, sort_order)
                VALUES (?, NULL, ?, ?, ?)
                """,
                (cat["name"], cat["emoji"], cat["colour"], cat["sort_order"]),
            )
            inserted_parents += 1
        except sqlite3.IntegrityError:
            pass  # already exists

    for parent_name, children in CHILD_CATEGORIES.items():
        row = conn.execute(
            "SELECT id FROM categories WHERE name = ? AND parent_id IS NULL", (parent_name,)
        ).fetchone()
        if row is None:
            logger.error("Parent category not found: %s", parent_name)
            continue
        parent_id = row["id"]

        for i, child_name in enumerate(children, start=1):
            try:
                conn.execute(
                    """
                    INSERT INTO categories (name, parent_id, sort_order)
                    VALUES (?, ?, ?)
                    """,
                    (child_name, parent_id, i),
                )
                inserted_children += 1
            except sqlite3.IntegrityError:
                pass  # already exists

    logger.info("Categories seeded: %d parents, %d children", inserted_parents, inserted_children)


def main() -> None:
    logger.info("Initialising database at %s", str(get_db_path_str()))
    conn = get_connection()

    with transaction(conn):
        for statement in DDL.strip().split(";"):
            stmt = statement.strip()
            if stmt:
                conn.execute(stmt)
        logger.info("Schema created / verified")

        seed_categories(conn)

    conn.close()
    logger.info("Database initialisation complete")


def get_db_path_str() -> str:
    from utils.db import get_db_path
    return str(get_db_path())


if __name__ == "__main__":
    main()
