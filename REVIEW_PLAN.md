# REVIEW_PLAN.md — Dashboard Review Action Plan

Created: 2026-06-17 (Session 8, post full-site review)

This is the actionable checklist coming out of the full UX / IA / functionality review.
Tick items off as they land. Ordered by priority. See PROGRESS.md for overall build phases.

## Direction decisions (locked in this review)

- **Build both `/budget` and `/cashflow`** — no more 404s; complete the core finance feature set.
- **Keep Net Worth and Balance Sheet as separate routes, but differentiate them** — Net Worth =
  trend/summary view; Balance Sheet = detailed positions. Do NOT merge.

---

## 1. 🔴 Fix dead navigation — build the missing pages ✅ DONE (Session 8)

Both `/budget` and `/cashflow` were linked in `Sidebar.tsx` but had no page → 404. Both now built and verified (200, real data).

### 1a — Budget vs Actual (`/budget`) ✅ DONE (Session 8)
Decision: **child-category level** budgets, **editable in-app**. Schema already existed
(`budgets` table + `v_budget_vs_actual` view, `scripts/db_init.py:92`, `:201`).

- [x] `lib/db.ts`: `getBudgetRows(month)` — every expense child category with budget + actual spend (excludes Income/Transfers parents)
- [x] `lib/db.ts`: `upsertBudget(categoryId, month, cents)` — ON CONFLICT upsert; 0 deletes the row
- [x] `lib/actions.ts`: `setBudget(...)` server action with `revalidatePath('/budget')`
- [x] `app/budget/page.tsx` — month selector (`MonthNav` basePath=/budget), KPI row (total budget/spent/remaining/count)
- [x] `components/budget/BudgetEditor.tsx` — grouped-by-parent table, inline editable `$` inputs (save on blur/Enter), spent / budget / remaining
- [x] Progress bar per category (emerald < 85% / amber ≥ 85% / rose over budget)
- [x] Over-budget remaining highlighted rose
- [x] Empty state when no budgets set for the month
- [x] Editable from the UI (also satisfies the Phase 5 "editable budgets" item)
- [x] Verified: 200, real spend figures, upsert SQL valid against live DB

### 1b — Cash Flow (`/cashflow`) ✅ DONE (Session 8)
Derived entirely from existing `transactions` (income > 0, expense < 0, `is_transfer = 0`).

- [x] `lib/db.ts`: `getCashflow(months)` — per-month income, expense, net savings (12 months)
- [x] `app/cashflow/page.tsx` — KPI row (latest month income/expense/net/savings-rate w/ MoM trend) + monthly breakdown table
- [x] `components/charts/CashflowChart.tsx` — income/expense bars + net line (Recharts ComposedChart)
- [x] Income trend now surfaced here (was only a single Overview KPI)
- [x] Empty state
- [x] Verified: 200, renders real data, no 404

---

## 2. 🟠 Differentiate Net Worth vs Balance Sheet + group the sidebar ✅ DONE (Session 8)

The two pages were ~80% duplicated. Each now has a distinct job (not merged).

- [x] **Net Worth** (`/networth`) = trend/summary: KPI row + stacked-area composition chart +
      Net Worth History line chart (moved here) + QoQ/YoY change cards + link to Balance Sheet.
      Detailed asset/liability tables removed.
- [x] **Balance Sheet** (`/balance-sheet`) = detailed positions: KPI row, per-account asset/liability
      breakdown, debt summary, quarterly account-history table, "View trends →" link to Net Worth.
      Redundant history line chart removed.
- [x] No orphaned queries: `getNetWorthHistory` still used by both; `NetWorthHistoryChart` moved to Net Worth.
- [x] **Sidebar grouping** (`Sidebar.tsx`): sections — Overview / Spending (Spending·Trends·Deep Dive·Transactions) / Planning (Budget·Cash Flow) / Wealth (Net Worth·Balance Sheet).
- [x] Verified: each wealth page has a distinct purpose; sidebar reads as grouped sections; typecheck clean.

---

## 3. 🟡 Overview improvements ✅ DONE (Session 8)

- [x] Month-over-month trend on Overview KPI cards (Spent / Income / Savings rate), computed on a
      fair same-day-of-month basis via `getSpendIncomeUpToDay(month, day)`.
- [x] `KpiCard` extended with optional `trend.direction` so "up = bad" (spending) shows the right
      arrow independent of colour sentiment.
- [x] "Month to date" subtitle on Spent + Income so a mid-month partial figure isn't read as a full month.
- [x] Verified: trends render with correct arrows/colours; typecheck clean.

---

## 4. 🟡 Make donut slices drillable

- [ ] Overview + Spending donuts: clicking a slice navigates to that category's Deep Dive
      (`/deep-dive?parent=<id>`). Routes + data already exist — this is wiring in `SpendingDonut`.
- [ ] Acceptance: click a slice → land on that category's deep dive

---

## 5. 🟡 Data quality — bad net-worth quarter

- [ ] The 2025-09-30 quarter shows ~ -$1.05M net worth from blank source cells (see PROGRESS Session 6).
      Either complete the source spreadsheet and re-run `ingest_balance_sheet.py`, or filter the
      incomplete quarter so it doesn't distort chart axes.
- [ ] Acceptance: net-worth charts have a sane y-axis with no phantom dip

---

## 6. 🟡 Mobile-responsive layout

Access is over Tailscale incl. phone (README). Sidebar is a fixed `w-56` with no collapse.

- [ ] Collapsible sidebar / hamburger on small screens (`Sidebar.tsx`, `layout.tsx`)
- [ ] Verify tables (transactions, account history, debt summary) scroll/reflow on narrow widths
- [ ] Acceptance: usable on a phone-width viewport

---

## 7. 🟢 Lower priority / nice-to-haves

- [ ] Data-freshness badge — show last ingest / "data as at" date somewhere persistent
- [ ] Single source of truth for category colours — currently split across `tailwind.config.ts`
      (`category.*`, largely unused), the DB `colour` column, and `chartColors.ts`
- [ ] Consistent income/expense colour convention (income emerald; expenses currently plain white)
- [ ] Transactions: custom date-range filter; flag/note on individual transactions (Phase 4f / 5)

---

## Do NOT touch (working well)

- Visual system: slate-950/900/800 palette, `rounded-2xl` cards, `tabular-nums`, uppercase labels
- `lib/db.ts` query layer — clean, parameterised, well-typed
- Deep Dive default-state category grid + selector pattern
- Empty-state handling on Net Worth / Balance Sheet
