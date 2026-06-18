# CLAUDE.md — Finboard Project Instructions

This file tells Claude Code how to work on this project. Read it at the start of every session before touching any code.

---

## What This Project Is

Finboard is a self-hosted personal finance dashboard for a single user (Sabs). It aggregates:
- Banking transactions from Frollo CSV exports (ANZ + HSBC, CDR Open Banking)
- Investment data from the Sharesight API
- Property valuations (manual)
- Other assets and liabilities (manual)

All data lives in a local SQLite database on a Synology DS920+ NAS. The dashboard is a Next.js app served via Docker, accessed over Tailscale.

Full context is in `README.md`. Schema is in `SCHEMA.md`. Build progress is in `PROGRESS.md`.

---

## Current State

**Always check `PROGRESS.md` first.** It is the source of truth for what is built, what is in progress, and what is next. Do not assume anything is done unless it is marked complete there.

---

## Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| Database | SQLite (WAL mode) | `better-sqlite3` on the dashboard side, `sqlite3` stdlib in Python scripts |
| Ingest | Python 3.11+ | Scripts in `scripts/` |
| Dashboard | Next.js 14, App Router | Server components preferred for data fetching |
| Styling | Tailwind CSS | No other CSS frameworks |
| Charts | Recharts | Wrap in components under `dashboard/components/charts/` |
| Runtime | Docker on DS920+ | `docker-compose.yml` in `docker/` |

---

## Code Style

### Python (ingest scripts)
- Type hints on all functions
- Docstrings on all public functions
- Use `pathlib.Path` not string paths
- Use `logging` not `print` (logger configured in `utils/logger.py`)
- All database writes wrapped in transactions
- Deduplication is mandatory — scripts must be safe to re-run on the same data
- Dates stored as ISO 8601 strings (`YYYY-MM-DD`) in SQLite
- Amounts stored as integers (cents) to avoid float precision issues

### TypeScript / Next.js
- Strict TypeScript — no `any`
- Server components for all data fetching (no client-side API calls to the local DB)
- Currency always displayed in AUD with `$` prefix, formatted via `lib/formatters.ts`
- Dates always displayed in Australian format (`DD MMM YYYY`)
- All database queries in `lib/db.ts` — no inline SQL in components
- Component files: PascalCase. Utility files: camelCase.

### General
- No hardcoded paths — use environment variables from `.env`
- No credentials in code — ever
- Write defensive code: assume CSV exports will have missing fields, weird encodings, duplicate rows
- Every script should log what it did: rows inserted, rows skipped (duplicates), errors

---

## Database Rules

- **Amounts are always stored in cents (integer).** `$12.50` → `1250`. This is non-negotiable. Display layer handles formatting.
- **Dates are always `YYYY-MM-DD` strings.** SQLite has no native date type.
- **Never delete rows.** Use soft deletes (`is_deleted INTEGER DEFAULT 0`) where needed.
- **Deduplication key for transactions**: `(account_id, transaction_date, amount_cents, description)` — use `INSERT OR IGNORE`.
- **Category hierarchy**: two levels only — `parent_category` and `category`. Examples: `Food & Drink / Groceries`, `Transport / Fuel`, `Income / Salary`.
- **All foreign keys enforced**: run `PRAGMA foreign_keys = ON` at connection open.

---

## Categories

The category system is the most important design decision. Do not change the category structure mid-project without updating `categories.json`, the database seed, and `SCHEMA.md`.

Current top-level categories:
- Income
- Housing
- Food & Drink
- Transport
- Health
- Utilities
- Entertainment
- Shopping
- Travel
- Education
- Financial (loan repayments, insurance, fees)
- Investments (transfers to investment accounts — not expenses)
- Transfers (internal account movements — excluded from budget calculations)
- Uncategorised

Frollo category names do not map 1:1 to our categories. The mapping is in `config/categories.json`. When Frollo introduces a new category name not in the mapping, it falls to `Uncategorised` and gets logged as a warning.

**Auto-categorisation rules now live in SQLite, not JSON.** The `category_rules` table is the single source of truth for merchant (exact) and description (keyword substring) rules — it replaced `config/merchant_rules.json` and `config/description_rules.json` (kept only as backup; migrated via `scripts/migrate_rules_to_db.py`). Ingest reads rules from the table; the dashboard manages them. Resolution priority is unchanged: merchant rule > description keyword rule > Frollo category map. Three dashboard pages under the sidebar "Manage" section maintain this:
- **`/import`** — upload a Frollo/AMP CSV; a server action runs the Python ingest and streams the log.
- **`/categorise`** — bulk grid to categorise transactions; a keyword turns a row into a rule applied DB-wide, no keyword is a one-off.
- **`/rules`** — create/list/delete rules directly; creating one applies it to all matching transactions live.

---

## Session Workflow

At the start of each session:
1. Read `PROGRESS.md` to understand current state
2. Confirm with the user what the session goal is
3. Do not refactor completed phases unless specifically asked
4. Make incremental, testable changes

At the end of each session:
1. Update `PROGRESS.md` — mark completed items, add any new discoveries or blockers
2. Commit with a descriptive message: `feat: add Frollo CSV ingest with deduplication`
3. Note any decisions made that affect future sessions

---

## What Not To Do

- Do not install Prisma, Drizzle, or any ORM — raw SQL via `better-sqlite3` and `sqlite3` only
- Do not use `useEffect` for data fetching — use server components
- Do not add authentication — Tailscale handles access control
- Do not add a cloud database — SQLite only
- Do not change the port from 3000 without updating `docker-compose.yml` and `README.md`
- Do not use `var` in TypeScript
- Do not commit `.env`, `data/`, or `*.db` files — check `.gitignore`

---

## File Locations (NAS Production)

```
/volume1/finance/finance.db         ← database
/volume1/finance/exports/frollo/    ← drop Frollo CSVs here
/volume1/finance/logs/ingest.log    ← ingest logs
```

In development these are overridden by `.env` to local paths.

---

## Testing Ingest Scripts

Always test ingest scripts with:
1. A fresh (empty) database — confirm it loads without errors
2. The same file twice — confirm deduplication works (row count identical on second run)
3. A file with a missing/malformed column — confirm it logs a warning and skips the row, not crashes

---

## Useful Commands

```bash
# Initialise database from scratch
python scripts/db_init.py

# Run Frollo ingest manually (also reachable from the dashboard /import page)
python scripts/ingest_frollo.py

# Migrate legacy JSON category rules into the category_rules table (one-off; idempotent)
python scripts/migrate_rules_to_db.py

# Sync Sharesight
python scripts/sync_sharesight.py

# Recalculate net worth snapshots
python scripts/net_worth.py

# Inspect database
sqlite3 data/finance.db ".tables"
sqlite3 data/finance.db "SELECT COUNT(*) FROM transactions;"

# Start dashboard in dev
cd dashboard && npm run dev

# Build and run via Docker
docker-compose -f docker/docker-compose.yml up -d --build

# Tail ingest logs
tail -f /volume1/finance/logs/ingest.log
```

---

## Key Decisions Log

| Decision | Rationale |
|---|---|
| SQLite over PostgreSQL | Single writer, zero ops, trivially backed up, scale is irrelevant for personal finance data |
| No ORM | Adds complexity without benefit for a small, stable schema |
| Amounts as cents (integer) | Float precision bugs in financial data are unacceptable |
| Server components for DB queries | No API layer needed for a local-only app; simpler stack |
| Tailscale for access control | Already configured on NAS; no auth code to maintain |
| Frollo CSV (not API) | Frollo has no consumer API; CSV export is the only egress method for personal use |
| Two-level category hierarchy | Deep hierarchies add complexity without proportionate value for personal finance |
