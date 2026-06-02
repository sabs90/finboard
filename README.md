# Finboard — Personal Finance Master Dashboard

A self-hosted, privacy-first personal finance dashboard that aggregates banking data (via Frollo CDR export), investment data (via Sharesight API), property values, and other assets into a single local database, presented through a clean Next.js dashboard accessible securely over Tailscale.

---

## What It Does

- Ingests transaction data from Frollo CSV exports (ANZ + HSBC, CDR-compliant, no credential sharing)
- Pulls investment portfolio data from the Sharesight API nightly
- Tracks property values and mortgage balances
- Stores everything in a local SQLite database on a Synology DS920+ NAS
- Presents a unified dashboard with budget vs actual, spending by category, net worth over time, cash flow, and transaction drill-down
- Accessible remotely via Tailscale — no data ever touches the cloud

---

## Design Principles

- **Privacy-first**: all data stays on the local network; Frollo connection uses CDR Open Banking (no screen scraping, no credential sharing)
- **Own your data**: SQLite file is the source of truth; trivially backed up, inspectable with any SQLite browser
- **Aesthetic and functional**: not a utility tool — designed to look good and be used daily
- **Vibe-coded incrementally**: built session by session with Claude Code, each session producing a working deliverable

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Database | SQLite (WAL mode) | Zero ops, single file, trivially backed up |
| Ingest | Python 3.11+ | Standard library sqlite3, simple CSV/API handling |
| Dashboard | Next.js 14 (App Router) | Familiar from MathsMap; server components suit local-only setup |
| Charting | Recharts | React-native, good defaults, easy to customise |
| Styling | Tailwind CSS | Rapid UI iteration |
| Hosting | Docker on DS920+ | Alongside existing NAS containers |
| Remote access | Tailscale | Already configured; zero-config secure tunnel |
| Scheduler | cron (DSM Task Scheduler) | Triggers nightly ingest |

---

## Repository Structure

```
finboard/
├── README.md
├── CLAUDE.md                   ← instructions for Claude Code sessions
├── PROGRESS.md                 ← build progress and to-do list
├── SCHEMA.md                   ← database schema documentation
│
├── scripts/                    ← Python ingest pipeline
│   ├── ingest_frollo.py        ← parses Frollo CSV exports → SQLite
│   ├── sync_sharesight.py      ← Sharesight API → SQLite
│   ├── sync_property.py        ← manual property value updates
│   ├── net_worth.py            ← calculates and stores net worth snapshots
│   └── utils/
│       ├── db.py               ← shared SQLite connection helpers
│       ├── categories.py       ← category normalisation rules
│       └── logger.py           ← shared logging config
│
├── dashboard/                  ← Next.js app
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            ← overview / home
│   │   ├── budget/
│   │   │   └── page.tsx        ← budget vs actual
│   │   ├── spending/
│   │   │   └── page.tsx        ← spending by category
│   │   ├── cashflow/
│   │   │   └── page.tsx        ← cash flow waterfall
│   │   ├── networth/
│   │   │   └── page.tsx        ← net worth over time
│   │   └── transactions/
│   │       └── page.tsx        ← transaction drill-down + search
│   ├── components/
│   │   ├── ui/                 ← shared UI primitives (cards, badges, etc.)
│   │   ├── charts/             ← chart wrappers (Recharts)
│   │   └── layout/             ← nav, sidebar, header
│   ├── lib/
│   │   ├── db.ts               ← better-sqlite3 query helpers
│   │   └── formatters.ts       ← currency, date formatters (AUD)
│   └── public/
│
├── data/                       ← gitignored; lives on NAS
│   ├── finance.db
│   └── exports/
│       ├── frollo/             ← drop Frollo CSV exports here
│       └── sharesight/
│
├── docker/
│   ├── docker-compose.yml
│   └── Dockerfile.dashboard
│
└── config/
    ├── .env.example
    └── categories.json         ← category mapping rules
```

---

## Data Sources

### 1. Frollo (Banking — ANZ + HSBC)

- **Connection method**: CDR Open Banking (no screen scraping, no credential sharing)
- **Export method**: Manual CSV export from Frollo app → saved to `data/exports/frollo/`
- **Export frequency**: Recommended weekly; ingest script deduplicates so re-importing is safe
- **Data included**: Transaction date, amount, merchant, Frollo category, account, notes, tags
- **Limitation**: 12-month history per export; start exporting immediately to accumulate history

**How to export from Frollo:**
1. Open Frollo app → Settings → Export Data
2. Frollo emails the CSV to your registered email
3. Save to `data/exports/frollo/` on the NAS
4. Ingest script picks it up on next run (or run manually)

### 2. Sharesight (Investments)

- **Connection method**: Sharesight REST API (OAuth2)
- **Data included**: Portfolio positions, valuations, dividends, performance, super (if linked)
- **Sync frequency**: Nightly via cron
- **Setup**: Create a Sharesight API application at sharesight.com/api, store credentials in `.env`

### 3. Property

- **Connection method**: Manual entry via `sync_property.py` CLI prompt
- **Data included**: Estimated market value, associated mortgage balance (pulled automatically from ANZ feed)
- **Update frequency**: Quarterly, or when a new valuation is available
- **Optional enhancement**: CoreLogic or Domain API for automated estimates (requires paid API access)

### 4. Other Assets / Liabilities

- **Method**: Manual entry in a simple YAML config or via a future admin UI
- **Examples**: Cash savings (not in ANZ/HSBC), HECS debt, car value, personal loans

---

## Database Overview

Full schema in `SCHEMA.md`. Key tables:

| Table | Purpose |
|---|---|
| `accounts` | Bank accounts, investment accounts, property, loans |
| `transactions` | All transactions from all sources |
| `categories` | Category hierarchy (parent + child) |
| `budgets` | Monthly budget allocations per category |
| `assets` | Point-in-time asset valuations (property, investments) |
| `net_worth_snapshots` | Daily/weekly net worth calculations |
| `portfolio_positions` | Sharesight holdings at each sync |

---

## Dashboard Views

### 1. Overview (Home)
- Net worth number, large and prominent
- Month-to-date spend vs budget (summary)
- Quick stats: savings rate this month, biggest spend category, portfolio return MTD
- Recent transactions (last 10)

### 2. Budget vs Actual
- Current month, with ability to navigate to prior months
- Category-level breakdown: budgeted / spent / remaining
- Visual progress bars per category
- Over-budget categories highlighted

### 3. Spending by Category
- Donut or treemap for current month
- Rolling 3-month and 12-month views
- Drill into a category to see individual transactions

### 4. Cash Flow
- Waterfall chart: income → category spends → net savings
- Monthly view with prior period comparison

### 5. Net Worth Over Time
- Line chart of total net worth over time
- Stacked area breakdown: property equity / investments / cash / liabilities
- Milestone markers (e.g. "granny flat complete", "Zeekr delivered")

### 6. Transactions
- Full searchable, filterable transaction list
- Filter by account, category, date range, amount
- Inline category editing (re-categorise directly)
- Flag/note individual transactions

---

## Local Network File Layout (NAS)

```
/volume1/finance/
├── finance.db
├── exports/
│   ├── frollo/
│   └── sharesight/
├── scripts/          ← symlinked or copied from repo
└── logs/
    └── ingest.log
```

---

## Remote Access

The dashboard is served locally (port 3000 inside Docker). Access from any device via Tailscale:

```
http://finboard.your-tailnet.ts.net:3000
```

No ports are exposed to the public internet. Tailscale authentication gates access.

---

## Setup Instructions

### Prerequisites
- Synology DS920+ with Docker package installed
- Tailscale node already configured on the NAS
- Python 3.11+ (via DSM Package Center or Docker)
- Node.js 20+ (for local dev; production runs in Docker)
- Frollo account with ANZ and HSBC connected
- Sharesight account with API access enabled

### Step 1 — Clone and configure

```bash
git clone https://github.com/youruser/finboard.git
cd finboard
cp config/.env.example config/.env
# Edit .env with Sharesight credentials and NAS paths
```

### Step 2 — Initialise the database

```bash
cd scripts
python db_init.py
# Creates finance.db with full schema + seed categories
```

### Step 3 — First Frollo import

```bash
# Export CSV from Frollo app, save to data/exports/frollo/
python ingest_frollo.py
```

### Step 4 — Connect Sharesight

```bash
# Follow SHARESIGHT_SETUP.md for OAuth flow
python sync_sharesight.py
```

### Step 5 — Add property and other assets

```bash
python sync_property.py --add
# Follow interactive prompts
```

### Step 6 — Start the dashboard

```bash
cd dashboard
npm install
npm run dev     # development
# or
docker-compose up -d   # production on NAS
```

### Step 7 — Configure cron (DSM Task Scheduler)

Add a nightly task in DSM → Control Panel → Task Scheduler:
```bash
cd /volume1/finance/scripts && python ingest_frollo.py && python sync_sharesight.py && python net_worth.py
```

---

## Environment Variables

```env
# Sharesight API
SHARESIGHT_CLIENT_ID=
SHARESIGHT_CLIENT_SECRET=
SHARESIGHT_PORTFOLIO_ID=

# Paths
DB_PATH=/volume1/finance/finance.db
FROLLO_EXPORT_DIR=/volume1/finance/exports/frollo
LOG_PATH=/volume1/finance/logs/ingest.log

# Dashboard
NEXT_PUBLIC_BASE_URL=http://finboard.your-tailnet.ts.net:3000
```

---

## Privacy and Security

- No transaction data is sent to any cloud service
- Frollo connection uses CDR Open Banking — bank credentials are never shared with any third party
- Sharesight API uses OAuth2 — token stored locally in `.env`, not in the database
- SQLite file is encrypted at rest via Synology's volume encryption
- Remote access gated by Tailscale device authentication
- `.env` and `data/` are gitignored — never committed

---

## Backup

The entire state of the system is in one file: `finance.db`. This is included in:
- Synology Hyper Backup (automatic, to external drive or Backblaze B2)
- Optionally: nightly `cp finance.db finance.db.bak` as a local snapshot

To restore: copy `finance.db` to the NAS, start Docker containers.
