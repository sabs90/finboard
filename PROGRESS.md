# PROGRESS.md — Finboard Build Tracker

Last updated: 2026-06-03

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
- [ ] Tested: malformed row handling ✓ — needs real Frollo CSV
- [x] `.env.example` written (at `config/.env.example`)
- [x] `.gitignore` configured (excludes `.env`, `data/`, `*.db`)
- [ ] First real Frollo export imported successfully

**Phase 1 complete**: [ ] — pending first real CSV import test

---

### Phase 2 — Investments + Net Worth
**Goal**: Sharesight connected, net worth calculation working.

- [ ] `SHARESIGHT_SETUP.md` — OAuth setup instructions
- [ ] `scripts/sync_sharesight.py` — pulls portfolio positions → `portfolio_positions` table
- [ ] `scripts/sync_property.py` — CLI for manual property value entry
- [ ] `scripts/net_worth.py` — calculates and stores net worth snapshots
- [ ] Net worth calculation verified manually against known figures
- [ ] Cron job configured in DSM Task Scheduler

**Phase 2 complete**: [ ]

---

### Phase 3 — Dashboard Shell
**Goal**: Next.js app running in Docker, accessible over Tailscale, with navigation and design system.

- [ ] `dashboard/` Next.js project initialised (App Router, TypeScript, Tailwind)
- [ ] `lib/db.ts` — better-sqlite3 query helpers
- [ ] `lib/formatters.ts` — AUD currency formatter, AU date formatter
- [ ] Navigation / sidebar layout component
- [ ] Design tokens / colour palette decided and documented
- [ ] Empty state screens for all 6 views
- [ ] `docker/Dockerfile.dashboard` written
- [ ] `docker/docker-compose.yml` written
- [ ] Dashboard running in Docker on NAS
- [ ] Accessible via Tailscale at `http://finboard.[tailnet].ts.net:3000`

**Phase 3 complete**: [ ]

---

### Phase 4 — Dashboard Views
**Goal**: All views populated with real data. Dashboard usable day-to-day.

#### 4a — Overview (Home)
- [ ] Net worth figure (current, large)
- [ ] Month-to-date spend vs budget summary
- [ ] Savings rate this month
- [ ] Biggest spend category this month
- [ ] Portfolio return MTD
- [ ] Recent transactions list (last 10)

#### 4b — Budget vs Actual
- [ ] Month selector (navigate to prior months)
- [ ] Category-level table: budgeted / spent / remaining
- [ ] Progress bars per category
- [ ] Over-budget highlight
- [ ] Initial budget amounts entered for all categories

#### 4c — Spending by Category
- [ ] Donut or treemap for current month
- [ ] Month / 3-month / 12-month toggle
- [ ] Drill-in to see transactions within a category

#### 4d — Cash Flow
- [ ] Waterfall chart: income → spends by category → net savings
- [ ] Monthly view
- [ ] Prior month comparison

#### 4e — Net Worth Over Time
- [ ] Line chart of total net worth
- [ ] Stacked area breakdown (property equity / investments / cash / liabilities)
- [ ] At least 3 months of history populated

#### 4f — Transactions
- [ ] Full transaction list, paginated
- [ ] Filter by account, category, date range
- [ ] Search by description
- [ ] Inline category re-assignment
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

### Session 1 — Phase 1: Data Foundation (2026-06-03)
- Built `scripts/utils/db.py` — WAL-mode connection, FK enforcement, transaction context manager
- Built `scripts/utils/logger.py` — console + file logging via `LOG_PATH` env var
- Built `scripts/db_init.py` — full schema DDL (all tables, indexes, views), seeds 14 parent + 52 child categories; idempotent
- Built `config/categories.json` — comprehensive Frollo → Finboard category mapping (~60 entries)
- Built `scripts/ingest_frollo.py` — CSV parsing with multi-format date support, column aliasing across Frollo export versions, `INSERT OR IGNORE` deduplication, account auto-creation, unmapped category warnings
- Added `.gitignore` and `config/.env.example`
- Repo initialised and pushed to GitHub
- **Blocker**: malformed-row and real-CSV tests pending — need a Frollo export to validate end-to-end
- **Next session**: Drop a Frollo CSV into `data/exports/frollo/` and run `python3 scripts/ingest_frollo.py`; then start Phase 2 or Phase 3

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

---

## Future Ideas (Not In Scope Yet)

- Automated Frollo CSV retrieval (parse the export email via a mail rule + script)
- CoreLogic API integration for automated property valuation updates
- Tax year reporting view (ATO financial year: 1 Jul – 30 Jun)
- FIRE number tracker (target net worth vs current, projected timeline)
- Granny flat ROI tracker (build cost vs rental income over time)
- Home Assistant integration (display daily spend on wall dashboard)
- Shared access for partner (read-only Tailscale node)
