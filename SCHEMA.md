# SCHEMA.md — Finboard Database Schema

SQLite database, WAL mode enabled. All amounts in **integer cents**. All dates as **ISO 8601 strings** (`YYYY-MM-DD`). All timestamps as **Unix epoch integers**.

Enable at connection open:
```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
```

---

## Tables

### `accounts`

Represents every financial account — bank accounts, investment portfolios, property, loans.

```sql
CREATE TABLE accounts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,                      -- e.g. "ANZ Everyday", "HSBC Transaction"
    institution     TEXT NOT NULL,                      -- e.g. "ANZ", "HSBC", "Sharesight", "Manual"
    account_type    TEXT NOT NULL,                      -- "transaction", "savings", "credit_card",
                                                        --   "investment", "property", "loan", "super"
    currency        TEXT NOT NULL DEFAULT 'AUD',
    is_active       INTEGER NOT NULL DEFAULT 1,
    source          TEXT NOT NULL,                      -- "frollo", "sharesight", "manual"
    external_id     TEXT,                               -- Frollo account ID or Sharesight portfolio ID
    created_at      INTEGER NOT NULL,                   -- Unix timestamp
    notes           TEXT
);

CREATE UNIQUE INDEX idx_accounts_external ON accounts(source, external_id)
    WHERE external_id IS NOT NULL;
```

**account_type values:**
- `transaction` — everyday transaction account
- `savings` — savings/offset account
- `credit_card` — credit card
- `investment` — share portfolio, ETFs
- `property` — real estate asset
- `loan` — mortgage, personal loan
- `super` — superannuation

---

### `transactions`

Every financial transaction from all sources.

```sql
CREATE TABLE transactions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id          INTEGER NOT NULL REFERENCES accounts(id),
    transaction_date    TEXT NOT NULL,                  -- YYYY-MM-DD
    posted_date         TEXT,                           -- YYYY-MM-DD; NULL if still pending
    amount_cents        INTEGER NOT NULL,               -- positive = credit, negative = debit
    description         TEXT NOT NULL,                  -- raw merchant/description from bank
    merchant            TEXT,                           -- cleaned merchant name (from Frollo)
    category_id         INTEGER REFERENCES categories(id),
    parent_category_id  INTEGER REFERENCES categories(id),
    is_transfer         INTEGER NOT NULL DEFAULT 0,     -- 1 = internal transfer (exclude from budget)
    is_pending          INTEGER NOT NULL DEFAULT 0,
    is_flagged          INTEGER NOT NULL DEFAULT 0,
    notes               TEXT,                           -- user-added notes
    tags                TEXT,                           -- comma-separated tags from Frollo
    source              TEXT NOT NULL,                  -- "frollo", "sharesight", "manual"
    source_id           TEXT,                           -- Frollo transaction ID (for dedup)
    created_at          INTEGER NOT NULL,
    updated_at          INTEGER NOT NULL
);

-- Deduplication index: safe to re-import same Frollo export
CREATE UNIQUE INDEX idx_transactions_dedup ON transactions(account_id, transaction_date, amount_cents, description)
    WHERE source = 'frollo';

CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_category ON transactions(category_id);
```

**Amount convention:**
- Debit (money out): **negative** — e.g. `$45.00 groceries` → `-4500`
- Credit (money in): **positive** — e.g. `$5000 salary` → `500000`

---

### `categories`

Two-level category hierarchy. Parent categories have `parent_id = NULL`. Child categories reference a parent.

```sql
CREATE TABLE categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    parent_id   INTEGER REFERENCES categories(id),      -- NULL = top-level category
    emoji       TEXT,                                   -- optional display emoji
    colour      TEXT,                                   -- hex colour for charts e.g. "#3B82F6"
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX idx_categories_name_parent ON categories(name, COALESCE(parent_id, 0));
```

**Seed data (top-level categories):**

| Name | Emoji | Colour |
|---|---|---|
| Income | 💰 | #22C55E |
| Housing | 🏠 | #8B5CF6 |
| Food & Drink | 🍔 | #F59E0B |
| Transport | 🚗 | #3B82F6 |
| Health | ❤️ | #EF4444 |
| Utilities | ⚡ | #06B6D4 |
| Entertainment | 🎬 | #EC4899 |
| Shopping | 🛍️ | #F97316 |
| Travel | ✈️ | #14B8A6 |
| Education | 📚 | #6366F1 |
| Financial | 🏦 | #64748B |
| Investments | 📈 | #10B981 |
| Transfers | 🔄 | #94A3B8 |
| Uncategorised | ❓ | #9CA3AF |

**Example child categories:**
- Food & Drink → Groceries, Restaurants, Coffee, Alcohol, Takeaway
- Transport → Fuel, Parking, Public Transport, Rideshare, Tolls
- Housing → Rent/Mortgage, Rates, Strata, Insurance, Maintenance
- Health → Pharmacy, GP / Medical, Gym, Dental, Optical

---

### `budgets`

Monthly budget allocations per category. One row per category per month.

```sql
CREATE TABLE budgets (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id     INTEGER NOT NULL REFERENCES categories(id),
    month           TEXT NOT NULL,                      -- YYYY-MM e.g. "2026-06"
    amount_cents    INTEGER NOT NULL,                   -- monthly budget in cents
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_budgets_category_month ON budgets(category_id, month);
```

---

### `assets`

Point-in-time valuations for non-transaction assets (property, property equity).

```sql
CREATE TABLE assets (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL REFERENCES accounts(id),
    valuation_date  TEXT NOT NULL,                      -- YYYY-MM-DD
    value_cents     INTEGER NOT NULL,                   -- current estimated value
    source          TEXT NOT NULL,                      -- "manual", "corelogic", "domain"
    notes           TEXT,
    created_at      INTEGER NOT NULL
);

CREATE INDEX idx_assets_account_date ON assets(account_id, valuation_date);
```

---

### `portfolio_positions`

Sharesight holdings snapshot at each sync. One row per holding per sync date.

```sql
CREATE TABLE portfolio_positions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL REFERENCES accounts(id),
    sync_date       TEXT NOT NULL,                      -- YYYY-MM-DD
    symbol          TEXT NOT NULL,                      -- e.g. "VAS", "MSFT"
    name            TEXT,                               -- e.g. "Vanguard Australian Shares"
    quantity        REAL NOT NULL,
    market_price    INTEGER NOT NULL,                   -- cents per unit
    market_value    INTEGER NOT NULL,                   -- cents total
    currency        TEXT NOT NULL DEFAULT 'AUD',
    created_at      INTEGER NOT NULL
);

CREATE UNIQUE INDEX idx_portfolio_position ON portfolio_positions(account_id, sync_date, symbol);
CREATE INDEX idx_portfolio_date ON portfolio_positions(sync_date);
```

---

### `net_worth_snapshots`

Calculated net worth at a point in time. Generated by `net_worth.py` — do not edit manually.

```sql
CREATE TABLE net_worth_snapshots (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date               TEXT NOT NULL UNIQUE,   -- YYYY-MM-DD
    total_assets_cents          INTEGER NOT NULL,
    total_liabilities_cents     INTEGER NOT NULL,
    net_worth_cents             INTEGER NOT NULL,       -- assets - liabilities
    -- breakdown
    cash_cents                  INTEGER NOT NULL DEFAULT 0,
    investment_cents            INTEGER NOT NULL DEFAULT 0,
    property_value_cents        INTEGER NOT NULL DEFAULT 0,
    property_equity_cents       INTEGER NOT NULL DEFAULT 0,  -- property value - mortgage balance
    super_cents                 INTEGER NOT NULL DEFAULT 0,
    other_assets_cents          INTEGER NOT NULL DEFAULT 0,
    mortgage_cents              INTEGER NOT NULL DEFAULT 0,
    other_liabilities_cents     INTEGER NOT NULL DEFAULT 0,
    created_at                  INTEGER NOT NULL
);
```

---

## Views

Useful pre-built views to simplify dashboard queries.

### `v_monthly_spend`

Spend per category per month (debits only, excluding transfers).

```sql
CREATE VIEW v_monthly_spend AS
SELECT
    strftime('%Y-%m', t.transaction_date) AS month,
    c.parent_id,
    pc.name AS parent_category,
    t.category_id,
    c.name AS category,
    c.colour,
    SUM(t.amount_cents) AS total_cents,        -- negative; use ABS() for display
    COUNT(*) AS transaction_count
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN categories pc ON c.parent_id = pc.id
WHERE t.amount_cents < 0
  AND t.is_transfer = 0
  AND (t.is_pending = 0 OR t.posted_date IS NOT NULL)
GROUP BY 1, 2, 3, 4, 5, 6;
```

### `v_budget_vs_actual`

Budget vs actual spend per category per month.

```sql
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
```

### `v_monthly_income`

Total income per month (credits to transaction/savings accounts, excluding transfers).

```sql
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
```

---

## Category Mapping (Frollo → Finboard)

Frollo uses its own category names. `config/categories.json` maps these to Finboard categories. Structure:

```json
{
  "Groceries": {"parent": "Food & Drink", "child": "Groceries"},
  "Restaurants & Cafes": {"parent": "Food & Drink", "child": "Restaurants"},
  "Coffee": {"parent": "Food & Drink", "child": "Coffee"},
  "Petrol & Fuel": {"parent": "Transport", "child": "Fuel"},
  "Public Transport": {"parent": "Transport", "child": "Public Transport"},
  "Ride Share": {"parent": "Transport", "child": "Rideshare"},
  "Salary & Wages": {"parent": "Income", "child": "Salary"},
  "Home & Garden": {"parent": "Housing", "child": "Maintenance"},
  "Health & Medical": {"parent": "Health", "child": "GP / Medical"},
  "Pharmacy & Chemist": {"parent": "Health", "child": "Pharmacy"},
  "Electricity": {"parent": "Utilities", "child": "Electricity"},
  "Internet": {"parent": "Utilities", "child": "Internet"},
  "Mobile Phone": {"parent": "Utilities", "child": "Mobile"},
  "Subscriptions": {"parent": "Entertainment", "child": "Subscriptions"},
  "Transfer": {"parent": "Transfers", "child": null, "is_transfer": true}
}
```

Unmapped Frollo categories → `Uncategorised`. Log a warning for each unmapped category encountered.

---

## Migration Strategy

Schema changes should be managed as numbered migration scripts:

```
scripts/migrations/
  001_initial_schema.sql
  002_add_tags_to_transactions.sql
  ...
```

`db_init.py` runs all migrations in order. Each migration is idempotent (uses `IF NOT EXISTS`, `IF column NOT EXISTS` guards).
