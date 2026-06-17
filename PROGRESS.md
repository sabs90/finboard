# PROGRESS.md — Finboard Build Tracker

Last updated: 2026-06-16 (Session 6)

---

## Build Phases

### Phase 1 — Data Foundation
**Goal**: Real data in a local SQLite database. Ingest pipeline working.

- [x] `SCHEMA.md` written and reviewed
- [x] `scripts/utils/db.py` — connection helper, WAL mode, foreign keys on
- [x] `scripts/utils/logger.py` — shared logging config
- [x] `scripts/db_init.py` — creates schema, seeds categories
- [x] `config/categories.json` — Frollo → Finboard category mapping
- [x] `scripts/ingest_frollo.py` — parses Frollo CSV, deduplicates, loads transactions
- [x] Tested: fresh DB load ✓
- [x] Tested: duplicate CSV re-import (idempotent) ✓ — db_init re-run inserts 0 rows
- [x] Tested: malformed row handling ✓ — 0 errors on 3362-row real CSV
- [x] `.env.example` written (at `config/.env.example`)
- [x] `.gitignore` configured (excludes `.env`, `data/`, `*.db`)
- [x] First real Frollo export imported successfully — 3361 inserted, 1 duplicate caught, 0 errors

**Phase 1 complete**: [x]

---

### Phase 2 — Investments + Net Worth
**Goal**: Sharesight connected, net worth calculation working. Balance sheet page live in dashboard.

#### 2a — AMP Transaction Ingest (complete)
- [x] `scripts/ingest_amp.py` — parses AMP CSV format (header skip, DD-Mon-YY dates, Balance column)
- [x] `scripts/db_init.py` — updated with AMP dedup index (`source = 'amp'`)
- [x] Committed (Session 6)

#### 2b — Balance Sheet Database Tables (complete)
Two new tables added as migration in `scripts/db_init.py`:

```sql
-- Quarterly balances for cash/investment accounts (fed from balance sheet xlsx)
CREATE TABLE IF NOT EXISTS account_balances (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id      INTEGER NOT NULL REFERENCES accounts(id),
    balance_date    TEXT NOT NULL,       -- YYYY-MM-DD (quarter-end)
    balance_cents   INTEGER NOT NULL,
    source          TEXT NOT NULL DEFAULT 'manual',
    created_at      INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_balances ON account_balances(account_id, balance_date);

-- Quarterly loan facility snapshots (balance + interest rate)
CREATE TABLE IF NOT EXISTS loan_snapshots (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id          INTEGER NOT NULL REFERENCES accounts(id),
    snapshot_date       TEXT NOT NULL,   -- YYYY-MM-DD (quarter-end)
    outstanding_cents   INTEGER NOT NULL,
    interest_rate       REAL,            -- decimal e.g. 0.0619 = 6.19%
    facility_type       TEXT,            -- 'fixed' or 'variable'
    source              TEXT NOT NULL DEFAULT 'manual',
    created_at          INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_snapshots ON loan_snapshots(account_id, snapshot_date);
```

#### 2c — Balance Sheet Ingest Script (complete)
- [x] `scripts/ingest_balance_sheet.py` — parses `data/Balance Sheet (1).xlsx`, loads 30 quarters of data

**Spreadsheet structure** (`data/Balance Sheet (1).xlsx`, single sheet "Balance Sheet"):
- Columns D–AG (0-based indices 3–32) = quarterly dates, starting 2018-12-31, each +3 months
- Date generation: col index n → date = end of month for (2018-12-31 + (n−3) quarters)
- Dates confirmed: index 3=2018-12-31, index 11=2020-12-31, index 31=2025-12-31, index 32=2026-03-31

**Row map** (1-based Excel rows):
| Row | Label | Type |
|-----|-------|------|
| 6  | ANZ Access (offset) | cash |
| 7  | NAB Offset | cash |
| 8  | Citi | cash |
| 9  | ING | cash |
| 19 | AMP | cash |
| 20 | HSBC - Savings | cash |
| 21 | HSBC - expense | cash |
| 27 | CMC | investments |
| 28 | IG Markets | investments |
| 29 | Moelis | investments |
| 30 | Stockland | investments |
| 34 | Crypto | other |
| 35 | Qawamah Capital | other |
| 49 | 8/55 Alice st | property |
| 50 | 8 Yarran st | property |
| 51 | Toyota 86 | vehicle |
| 52 | Hyundai i30 | vehicle |
| 60 | Credit Cards | liability_other |
| 61 | Sabeeh - tax bill | liability_other |
| 64 | 8/55 Alice st (fixed) | mortgage — Alice St, Facility A (fixed) |
| 65 | 8/55 Alice st (variable) | mortgage — Alice St, Facility B (variable) |
| 66 | 8 Yarran st (fixed) | mortgage — Yarran St, Facility A (fixed) |
| 67 | 8 Yarran st (variable) | mortgage — Yarran St, Facility B (variable) |
| 113 | Int Rate — Yarran Facility A | rate (only populated cols 31+) |
| 117 | Int Rate — Yarran Facility B | rate (only populated cols 31+) |
| 122 | Int Rate — Alice Facility A | rate (only populated cols 31+) |
| 126 | Int Rate — Alice Facility B | rate (only populated cols 31+) |

**NOTE**: Row 66 (Yarran fixed) shows $1,037,000 at 2026-03-31 — big jump from $813,788. Likely a refinancing top-up. Verify with Sabs before treating as correct.

**Subtotals are all None** (formula cells without cached values). Must compute manually by summing raw rows.

**Script logic**:
1. Generate quarterly dates for col indices 3–32
2. For each account row: create account in `accounts` if not exists, insert into `account_balances` (upsert)
3. For property rows: also insert into `assets` table
4. For mortgage rows: create loan accounts, insert into `loan_snapshots`; attach interest rates where available (cols 31–32)
5. Compute and upsert `net_worth_snapshots` per quarter:
   - `cash_cents` = sum of rows 6,7,8,9,19,20,21
   - `investment_cents` = sum of rows 27,28,29,30
   - `property_value_cents` = sum of rows 49,50
   - `other_assets_cents` = vehicles (51,52) + crypto (34,35) + receivables (41,42)
   - `mortgage_cents` = sum of rows 64,65,66,67
   - `other_liabilities_cents` = sum of rows 60,61
   - `total_assets_cents` = all asset rows summed
   - `total_liabilities_cents` = mortgage + other liabilities
   - `net_worth_cents` = total assets − total liabilities
   - `property_equity_cents` = property_value − mortgage

**Update strategy**: Keep `data/Balance Sheet (1).xlsx` updated quarterly, re-run script (it upserts so safe to re-run).

#### 2d — Dashboard Balance Sheet Page (complete)
- [x] `dashboard/app/balance-sheet/page.tsx` — balance sheet page
- [x] `dashboard/components/layout/Sidebar.tsx` — "Balance Sheet" nav item added
- [x] `dashboard/components/charts/NetWorthHistoryChart.tsx` — quarterly line chart
- [x] `dashboard/lib/db.ts` — 4 new queries: getLatestNetWorthSnapshot, getNetWorthHistory, getLatestLoanSnapshots, getLatestAssetBreakdown

**Page layout**:
1. **KPI row** — Net Worth (large) | Total Assets | Total Liabilities (from latest `net_worth_snapshots` row)
2. **Asset breakdown** (left column) — donut chart + table: Cash / Investments / Property / Vehicles / Other
3. **Liability breakdown** (right column) — table: 4 mortgage facilities + credit cards/other
4. **Debt Summary** (full width) — table with columns: Property | Facility | Type | Balance | Rate | Annual Interest. Footer row: Total | | | $X | Wtd Avg Rate% | $X p.a.
5. **Net Worth History** (full width) — Recharts LineChart, quarterly from 2018, data from `net_worth_snapshots`

**DB queries needed** in `dashboard/lib/db.ts`:
- `getLatestNetWorthSnapshot()` → latest row from `net_worth_snapshots`
- `getNetWorthHistory()` → all rows from `net_worth_snapshots` ordered by date
- `getLatestLoanSnapshots()` → most recent `loan_snapshots` per account (with account name, facility_type, interest_rate)
- `getAssetBreakdown()` → latest `account_balances` per account, joined with `accounts` for type

#### 2e — Sharesight (deferred — needs API credentials)
- [ ] `SHARESIGHT_SETUP.md` — OAuth setup instructions
- [ ] `scripts/sync_sharesight.py` — pulls portfolio positions → `portfolio_positions` table
- [ ] Cron job configured in DSM Task Scheduler

**Phase 2 complete**: [ ]

---

### Phase 3 — Dashboard Shell
**Goal**: Next.js app running in Docker, accessible over Tailscale, with navigation and design system.

- [x] `dashboard/` Next.js project initialised (App Router, TypeScript, Tailwind)
- [x] `lib/db.ts` — better-sqlite3 query helpers (singleton, getMonthlySpend, getCategoryTransactions, getAllCategories)
- [x] `lib/formatters.ts` — AUD currency formatter, AU date formatter, month navigation
- [x] `lib/actions.ts` — server action for inline category reassignment
- [x] Navigation / sidebar layout component (dark slate sidebar, 5 nav items)
- [x] Spending by category page with drill-down to transactions
- [x] Inline category reassignment via `<select>` with optgroups
- [x] Month navigation (prev/next)
- [x] Dev server verified working with real data (200 on /spending)
- [x] Design tokens / colour palette decided and documented (Tailwind extended with surface + category colors)
- [x] Full dark theme conversion (slate-950/900/800 palette across all components)
- [x] Recharts installed and integrated for data visualization
- [ ] Empty state screens for all 6 views
- [ ] `docker/Dockerfile.dashboard` written
- [ ] `docker/docker-compose.yml` written
- [ ] Dashboard running in Docker on NAS
- [ ] Accessible via Tailscale at `http://finboard.[tailnet].ts.net:3000`

**Phase 3 partially complete** — dashboard shell running, spending view functional, Docker not yet done.

**Phase 3 complete**: [ ]

---

### Phase 4 — Dashboard Views
**Goal**: All views populated with real data. Dashboard usable day-to-day.

#### 4a — Overview (Home)
- [x] Net worth figure (current, large) — hero card linking to /networth
- [x] Month-to-date spend KPI card
- [x] Income KPI card
- [x] Savings rate this month
- [x] Biggest spend category this month
- [ ] Portfolio return MTD
- [x] Recent transactions list (last 10)
- [x] Spending by category donut chart
- [x] Monthly spending bar chart (6 months)

#### 4b — Budget vs Actual
- [ ] Month selector (navigate to prior months)
- [ ] Category-level table: budgeted / spent / remaining
- [ ] Progress bars per category
- [ ] Over-budget highlight
- [ ] Initial budget amounts entered for all categories

#### 4c — Spending by Category
- [x] Donut chart for current month
- [x] Month navigation (prev/next)
- [x] Category table with drill-down links to deep dive
- [x] Category deep dive page with 12-month stacked bar chart, subcategory breakdown, top merchants, transactions
- [x] Subcategory deep dive (click through from parent to child category)
- [x] Period selector (This Month / 3M / 6M / 12M) on deep dive pages
- [x] Comparison chips (vs last month, vs 3-month average)
- [x] Dedicated "Deep Dive" page in sidebar with parent + subcategory selectors
- [x] Subcategories have distinct colors reflected in stacked chart and bars
- [x] Monthly Trends pivot table (6-month parent/child expand-collapse, avg column, frozen header)

#### 4d — Cash Flow
- [ ] Waterfall chart: income → spends by category → net savings
- [ ] Monthly view
- [ ] Prior month comparison

#### 4e — Net Worth Over Time
- [x] Line chart of total net worth
- [x] Stacked area breakdown (property equity / investments / cash / other — 30 quarters)
- [x] KPI cards with QoQ and YoY change
- [x] Assets + liabilities breakdown tables

#### 4f — Transactions
- [x] Full transaction list, paginated (30 per page)
- [x] Filter by account, category
- [x] Search by description/merchant
- [x] Inline category re-assignment
- [ ] Filter by date range (month filter exists, custom range not yet)
- [ ] Flag / note on individual transactions

**Phase 4 complete**: [ ]

---

### Phase 5 — Polish + Ongoing Use
**Goal**: Stable, low-maintenance system that's a pleasure to use daily.

- [ ] Mobile-responsive layout (for phone access over Tailscale)
- [ ] Budget amounts editable from the UI (not just the database directly)
- [ ] Category re-assignment UI saves back to SQLite
- [ ] Error states and loading states on all views
- [ ] Ingest script sends a summary notification (e.g. email or Synology notification) after each run
- [ ] Automated weekly Frollo export reminder (calendar or Home Assistant automation)
- [ ] Documentation reviewed and updated to match final implementation

**Phase 5 complete**: [ ]

---

## Session Log

### Session 0 — Planning
- Decided on full architecture: Frollo CSV → SQLite → Next.js dashboard
- Chose SQLite over PostgreSQL (single writer, zero ops)
- Decided on Firefly III as optional parallel tool (may skip in favour of custom dashboard)
- Decided category hierarchy: two levels, seed from `categories.json`
- Decided amounts stored as integer cents
- Produced: README.md, CLAUDE.md, PROGRESS.md, SCHEMA.md
- **Next session**: Phase 1 — schema + db_init.py + ingest_frollo.py

### Session 2 — Phase 3: Dashboard shell (2026-06-03, interrupted)
- Dashboard directory and package.json/tsconfig.json created
- **Interrupted before writing any app code**

### Session 3 — Phase 3 + Category cleanup (2026-06-03 to 2026-06-09)
- **Dashboard shell completed**: all 15 app files written and verified
  - `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`
  - `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/spending/page.tsx`
  - `lib/db.ts`, `lib/formatters.ts`, `lib/actions.ts`
  - `components/layout/Sidebar.tsx`, `components/spending/MonthNav.tsx`, `components/spending/CategoryTable.tsx`
  - `components/transactions/TransactionList.tsx`, `components/transactions/CategoryPicker.tsx`
- Fixed: `better-sqlite3` bumped to v12 for Node 25 compatibility
- Fixed: `next.config.ts` → `next.config.mjs` (Next 14 doesn't support .ts config)
- **Category review workflow established** (CSV export → user edit → apply):
  - Workflow A: merchant-level (`scripts/apply_categories.py` → `config/merchant_rules.json`)
  - Workflow B: description keyword-level (`scripts/apply_description_categories.py` → `config/description_rules.json`)
- 3 rounds of category cleanup performed:
  - Round 1 (merchant): 1,397 txns updated, 105 merchant rules saved
  - Round 2 (description keywords): 1,376 txns updated, 119 keyword rules
  - Round 3+4 (further cleanup): 648 more txns updated, 144 total keyword rules
- New parent categories added: Tech, Property, Family, Islam
- New child categories: Books, Kids, Arts/Crafts/Projects, House, Fines, Maintenance (Transport), Car, Council & Water, Daycare, Zakat/Sadaqa, Mortgage, Sport, Pool, Rent, Salary, Cashback, Investments
- "Money Transfers" category added under Transfers — sets is_transfer=1, excluded from expense tracking
- Ingest pipeline now has 3-tier priority: merchant rules > description keyword rules > Frollo category mapping
- Final state: 1,911 categorised expenses, 90 money transfers, 157 uncategorised
- AMP CSV ingest still pending — user to provide sample CSV

### Session 7 — Net Worth page + Overview hero + Balance Sheet history table (2026-06-17)
- Added net worth hero card to Overview — large figure, equity/invest/cash breakdown, links to /networth
- Built `/networth` page: stacked area chart (30 quarters), KPI cards with QoQ change, asset/liability tables with YoY comparison
- Built historical balance table on balance sheet page: all accounts × all quarters, sticky name column, compact M/k format
- Fixed fmt() 10x magnitude bug (threshold/divisor mismatch in cents conversion)
- Fixed asset/liability detail rows pinned to snapshot date (not per-account MAX)
- Ingest carry-forward for uncached formula cells (vehicles, variable mortgage)
- **Next**: Docker deployment, then Budget vs Actual or Cash Flow

### Session 6 — Phase 2b/2c/2d: Balance Sheet end-to-end (2026-06-16)
- Committed AMP ingest work (was done but unstaged)
- Added `account_balances` and `loan_snapshots` tables to `scripts/db_init.py`
- Wrote `scripts/ingest_balance_sheet.py`:
  - Reads 30 quarters (2018-12-31 → 2026-03-31) from xlsx with `openpyxl data_only=True`
  - Generates quarter-end dates programmatically; xlsx row 1 only has one cached date
  - All values stored as integer cents, upserted on re-run
  - 281 account_balances, 93 loan_snapshots, 30 net_worth_snapshots loaded
  - Note: 2025-09-30 quarter has many blank cells in source spreadsheet — net worth shown as -$1.05M for that quarter; source data needs completing
- Built dashboard Balance Sheet page (`/balance-sheet`):
  - KPI row: Net Worth / Total Assets / Total Liabilities
  - Asset breakdown: donut chart (Property/Investments/Cash/Other) + category table
  - Liability breakdown: mortgage subtable + other liabilities (credit cards, tax)
  - Debt Summary: full-width table with facility type badges, interest rates, annual interest, weighted avg rate footer
  - Net Worth History: Recharts LineChart (NW + Total Assets + Mortgage, 30 quarters)
  - Added "Balance Sheet" to Sidebar nav
- Phase 2b + 2c + 2d complete ✓
- Post-session fixes: asset/liability detail rows anchored to snapshot date; ingest carry-forward for formula cells with uncached results

### Session 5 — Phase 2 planning + balance sheet analysis (2026-06-16)
- Reviewed uncommitted work from prior session: `scripts/ingest_amp.py` (complete) and `db_init.py` AMP dedup index
- Fully analysed `data/Balance Sheet (1).xlsx`:
  - 30 quarterly snapshots from 2018-12-31 to 2026-03-31
  - Row-by-row mapping confirmed for all assets and liabilities
  - Subtotals are all None (uncached SUBTOTAL formulas) — must sum manually
  - Interest rates only populated for Q4 2025 and Q1 2026 (Yarran A: 5.43%→6.19%, Yarran B: 6.04%, Alice A+B: 6.10%→6.60%)
  - Notable: Yarran St (fixed) jumps from $813k to $1,037k at Q1 2026 — possible refinancing top-up, verify
- Decided full plan for Phase 2b/2c/2d — documented above in detail
- **Session ended before writing any code** — full plan captured in PROGRESS.md
- **Next session**: implement 2b (schema tables), 2c (ingest script), 2d (dashboard page) in that order. Commit AMP work first.

### Session 4 — Dashboard redesign + category deep dive (2026-06-09)
- **Full dark theme conversion**: slate-950/900/800 palette across every component
- **Recharts integrated**: donut charts, bar charts, stacked bar charts
- **Overview page** (`/`): 4 KPI cards (spend, income, savings rate, top category), spending donut, 6-month bar chart, recent transactions
- **Spending page** upgraded: donut chart alongside category table, categories link to deep dive
- **Transactions page** (`/transactions`): search by description/merchant, filter by account/category, paginated (30/page), inline category reassignment
- **Category deep dive** (`/spending/category/[id]`):
  - Parent categories: stacked bar chart (12mo) with subcategory colors, subcategory breakdown bars, top merchants, transactions
  - Child categories: simple bar chart with average line, top merchants, transactions
  - Comparison chips: % vs last month, % vs 3-month average
  - Period selector: This Month / 3M / 6M / 12M
  - Click-through: subcategories link to their own deep dive, "Back to [parent]" breadcrumb
- **Deep Dive page** (`/deep-dive`): dedicated sidebar nav item, parent + subcategory selectors, category grid for quick access
- **Design system**: reusable Card/KpiCard components, 15-color subcategory palette, chartColors utility
- 33 files changed, 18 new files created
- **Trends page** (`/trends`): Excel-style pivot table — 6 months × parent/child categories, expand/collapse rows, 0-decimal formatting, avg column, sticky header
- **Next session**: Budget vs Actual (4b), Cash Flow (4d), Docker deployment, or Phase 2 (Sharesight)

### Session 1 — Phase 1: Data Foundation (2026-06-03)
- Built `scripts/utils/db.py` — WAL-mode connection, FK enforcement, transaction context manager
- Built `scripts/utils/logger.py` — console + file logging via `LOG_PATH` env var
- Built `scripts/db_init.py` — full schema DDL (all tables, indexes, views), seeds 14 parent + 52 child categories; idempotent
- Built `config/categories.json` — comprehensive Frollo → Finboard category mapping (~60 entries)
- Built `scripts/ingest_frollo.py` — CSV parsing with multi-format date support, column aliasing across Frollo export versions, `INSERT OR IGNORE` deduplication, account auto-creation, unmapped category warnings
- Added `.gitignore` and `config/.env.example`
- Repo initialised and pushed to GitHub
- Fixed column name mismatches against real Frollo export (transaction_date, category_name, merchant_name, user_tags, posted_date)
- Rebuilt categories.json with all 48 real Frollo category names; 0 unmapped on first real import
- Verified: 3361/3362 rows inserted on first run, 0 on re-run; accounts auto-created (HSBC EVERYDAY, ANZ Offset, Investment Loan)
- **Phase 1 complete ✓**
- **Next session**: Phase 3 (Next.js dashboard shell) — get the data visible; or Phase 2 (Sharesight) if Sharesight API credentials are ready

---

## Known Issues / Blockers

_None yet — update this section as issues arise._

---

## Decisions Made

| # | Decision | Session | Rationale |
|---|---|---|---|
| 1 | SQLite over PostgreSQL | 0 | Single writer, zero ops, trivially backed up |
| 2 | Amounts as integer cents | 0 | Float precision bugs in financial data are unacceptable |
| 3 | Two-level category hierarchy | 0 | Simpler to query and display; sufficient for personal use |
| 4 | No ORM | 0 | Adds complexity without benefit for a small, stable schema |
| 5 | Server components for DB access | 0 | No API layer needed; simpler stack for local-only app |
| 6 | Frollo CSV export (not API) | 0 | Frollo has no consumer API; CSV is the only personal-use egress path |
| 7 | 3-tier category resolution | 3 | Merchant rules > description keywords > Frollo category. Handles HSBC raw descriptions where Frollo can't identify merchant |
| 8 | CSV-based category review workflow | 3 | Export → user edits in Numbers/Excel → re-import. Repeatable for ongoing cleanup |

---

## Future Ideas (Not In Scope Yet)

- Automated Frollo CSV retrieval (parse the export email via a mail rule + script)
- CoreLogic API integration for automated property valuation updates
- Tax year reporting view (ATO financial year: 1 Jul – 30 Jun)
- FIRE number tracker (target net worth vs current, projected timeline)
- Granny flat ROI tracker (build cost vs rental income over time)
- Home Assistant integration (display daily spend on wall dashboard)
- Shared access for partner (read-only Tailscale node)
