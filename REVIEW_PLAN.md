# REVIEW_PLAN.md — Dashboard Review Action Plan

Created: 2026-06-17 (Session 8, post full-site review)
Round 2 added: 2026-06-19 (Session 10, fresh-eyes review)

This is the running review checklist. It now holds two rounds:
- **Round 2** (below) — the active plan, from the 2026-06-19 fresh-eyes review (benchmarked
  against Copilot / Monarch / Empower / Kubera). **Work this top-down.**
- **Round 1** — the original 2026-06-17 review; every item shipped (kept for reference).

Tick items off as they land. Ordered by priority. See PROGRESS.md for overall build phases.

---

# Round 2 — Fresh-eyes review action plan (Session 10, 2026-06-19)

Benchmarked Finboard against best-in-class apps. Verdict: asset breadth is Kubera-tier and
spending analytics are strong; the gaps are (a) a correctness bug inflating spend, (b) a
duplicated drill-down route, and (c) the signature features the leaders headline — recurring
detection, a cash-flow flow-viz, and proactive insights. Ordered by leverage.

## R2.1 🔴 Fix: credit-card payments counted as spending (correctness)

**Problem (verified against live DB):** the `Financial → Credit Card Payments` child has
**$7,268 across 19 txns with `is_transfer = 0`**. Paying a card is an internal transfer, not
consumption — and the card *purchases* are already recorded, so this **double-counts**,
inflating spend and understating savings rate. `v_monthly_spend` includes every
`amount_cents < 0 AND is_transfer = 0` row, so these leak in.

**Recommended fix** (mirror the existing `Money Transfers` pattern, which already sets
`is_transfer = 1`):
- [ ] **Backfill** existing rows: `UPDATE transactions SET is_transfer = 1, updated_at = …
  WHERE category_id = (SELECT id FROM categories WHERE name = 'Credit Card Payments')`.
- [ ] **Make it durable for future ingests.** Two options — pick one:
  - (A) In `config/categories.json`, map the Frollo "Credit Card Payments" category with
    `"is_transfer": true` (same shape as the `Transfer` entry), and have the resolver honour it; **or**
  - (B) Add a `category_rules` row (`rule_type='description'`, the CC-payment keyword,
    `is_transfer=1`). (A) is cleaner since it keys off the category, not a fragile keyword.
- [ ] **Audit pass for other internal flows** while here — run the audit query and decide each:
  - `Financial → Investments` (transfers to brokerage = saving, not spend)
  - any loan/mortgage **principal** repayments (net-worth-neutral; at least separate from consumption)
  - confirm `Transfers → Money Transfers` is still correctly flagged.
- [ ] Re-check: savings rate on `/` and `/cashflow` should rise once CC payments drop out.
- [ ] Verify: `SELECT SUM(...) FROM v_monthly_spend` no longer contains the CC-payment rows.

## R2.2 🔴 Collapse the duplicated drill-down route (IA + maintenance) ✅ DONE (Session 12)

**Problem:** `app/spending/category/[id]/page.tsx` and `app/deep-dive/page.tsx` were ~240 lines
each running the **same queries, layout, and components**, reached via two URLs.

**`/deep-dive` (selector + query-param state) is now the single canonical drill page:**
- [x] `CategorySelector` "View Deep Dive" button → `/deep-dive?parent=…&sub=…`.
- [x] `CategoryTable` — parent rows → `/deep-dive?parent=…`.
- [x] `SubcategoryBars` — → `/deep-dive?parent=<parent>&sub=<child>` (uses its `parentCategoryId` prop).
- [x] `PivotTable` — parent → `?parent=`, child → `?parent=&sub=` (child rows read `parent.parentId` in scope).
- [x] Ported the **"← Back to {parent}"** breadcrumb for child categories into `/deep-dive`.
- [x] **Deleted** `app/spending/category/` entirely; also removed the now-orphaned
  `components/spending/PeriodSelector.tsx` and its unused import in deep-dive.
- [x] Grep `spending/category` → **zero** source refs; old route 404s. Typecheck clean; every drill
  entry point (donut, category table, subcategory bars, pivot parent+child, selector) verified 200.

## R2.3 🟠 Recurring / subscriptions detection (biggest feature gap vs leaders) ✅ DONE (Session 11)

Headline feature of both Copilot and Monarch; Finboard has none, but has all the data.
- [x] `lib/db.ts`: `getRecurring()` — groups non-transfer expenses by `merchant`, keeps series
  with ≥3 occurrences whose gaps cluster (≥60%) around a monthly/quarterly/annual cadence **and**
  whose amount coefficient-of-variation ≤ 0.6 (drops ad-hoc spend that merely lands ~monthly —
  Doordash, Ogalo etc. — while keeping variable-amount utilities). Returns cadence, median &
  last amount, amount delta, last + next-expected date, monthly-equivalent, status. "now" is
  anchored to the latest txn date (not wall-clock) so import lag doesn't mark everything overdue.
- [x] `app/recurring/page.tsx` — grouped by cadence with per-cadence /mo subtotals; KPIs
  (monthly cost, annualised, price increases, not-seen-recently); status badges flag **price
  increases** and **"not seen — due {date}"** (possible cancellations).
- [x] `components/recurring/RecurringList.tsx`.
- [x] Sidebar: added under **Planning**. `getUpcomingBillsCount(14)` → "N bills expected in the
  next 14 days" link strip on Overview (only when > 0).
- [x] Empty state when nothing recurs yet (shared `<EmptyState>`).
- Verified: 14 series detected on live data (6 active / 7 not-seen / 1 price rise); the not-seen
  set is genuinely churned utilities/subs (Gmhba, Superloop, Exetel, Ovo). Typecheck clean, 200.

## R2.4 🟠 Cash-flow flow-viz — Sankey / waterfall (biggest aesthetic-credibility gap) ✅ DONE (Session 11)

README originally specced a **waterfall** (income → category spends → net savings); `/cashflow`
currently ships bars + a table only. The flow viz is Copilot's signature.
- [x] `components/charts/CashflowWaterfall.tsx` — Recharts waterfall (stacked transparent-base +
  visible bars with per-`<Cell>` category colours): income (up) → each parent category (down) →
  net savings. Net bar grounded at zero (drops below the axis when negative).
- [x] `lib/db.ts`: `getCashflowBreakdown(month)` — income total + spend per parent category + net.
- [x] Added a **month selector** (`MonthNav basePath=/cashflow`); the waterfall is per-month.
  Top 8 categories shown, remainder collapsed into "Other".
- [x] Kept the existing 12-month bar chart + table below; empty state for months with no data.
- Verified: May 2026 income $18,104 / expense $18,977 / net −$873; empty-month + month nav 200.

## R2.5 🟡 Insights panel + empty/loading states (polish that reads "best in class") ✅ DONE (Session 11)

- [x] `lib/db.ts`: `getInsights(month)` — biggest mover vs 3-mo avg, largest single transaction,
  new merchant this month, count of categories over budget.
- [x] `components/overview/InsightsPanel.tsx` on `/` — up to 4 auto-generated chips (mover shown
  only when |Δ| ≥ 10%; over-budget chip links to `/budget`; amber tone for warnings).
- [x] **Loading skeletons**: shared `components/ui/PageSkeleton.tsx` + `loading.tsx` on the 10
  data-display routes (/, spending, transactions, budget, cashflow, recurring, networth,
  balance-sheet, deep-dive, trends). Skipped the form/manage routes.
- [x] **Empty states**: factored `components/ui/EmptyState.tsx`; applied on Recurring, Cash Flow
  and Spending (whole-month-empty). Budget keeps its inline helper banner on purpose — a full
  empty state would hide the editor needed to set budgets.

## R2.6 🟡 IA tidy ✅ DONE (Session 12)

- [x] **Moved `/balance-input` ("Update Balances") from Wealth → Manage** in `Sidebar.tsx`.
- [x] **Spending is now a hub**: a single "Spending" sidebar door + a shared tab bar
  (`components/spending/SpendingTabs.tsx`: Breakdown · Trends · Transactions) on `/spending`,
  `/trends`, `/transactions`. **Deep Dive demoted** — removed from the sidebar; reachable only by
  drilling into a category. The Spending door stays highlighted across its tabs + `/deep-dive` via
  a new `activePrefixes` matcher on the sidebar nav item. Top-level doors cut from ~9 to 6.
- [x] Net Worth page: the second large chart (NW/assets/debt line) is now a collapsed-by-default
  `components/ui/CollapsibleCard.tsx` (Show/Hide toggle) to cut scroll.

## R2.7 🟢 Larger features — schedule into Phase 5+, not this round

Captured so they aren't lost; each is its own piece of work:
- [ ] **Non-monthly / sinking-fund budgeting** — spread annual/quarterly bills (rates, rego,
  strata, insurance — all present in the data) across months instead of flat monthly budgets.
- [ ] **Savings goals + FIRE number** — target line on the net-worth chart + progress card.
- [ ] **Net-worth milestone markers** — README specced them ("granny flat complete", "Zeekr
  delivered"); annotate the history chart.
- [ ] **Net-worth forecast** — project the trend forward at the current savings rate.
- [ ] **Investment holdings detail** — depends on Sharesight (Phase 2e, deferred).
- [ ] **KPI sparklines** — mini trend inside each KPI card (Copilot-style); series already computed.
- [ ] **Standardise income/expense colour** — one semantic system (inflow / neutral-outflow /
  over-budget-warning); today cashflow uses orange, `<Amount>` neutral, deep-dive rose.

---

# Round 1 — Initial review action plan (Session 8, 2026-06-17) — ✅ ALL DONE

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

## 4. 🟡 Make donut slices drillable ✅ DONE (Session 8)

- [x] `getCategoryBreakdown` now returns the parent `category_id`; both `prepareDonutData` helpers carry it.
- [x] `SpendingDonut` slices + legend entries route to `/deep-dive?parent=<id>` on click (useRouter).
- [x] Non-clickable where there's no id: the aggregated "Other" slice and the Balance Sheet asset donut.
- [x] Verified: breakdown returns parent ids; `/deep-dive?parent=3` resolves 200; typecheck clean.

---

## 5. 🟡 Data quality — bad net-worth quarter ✅ RESOLVED (verified Session 8)

- [x] No longer an issue: 2025-09-30 now reads +$1.02M (between Q2 $999k and Q4 $1.05M); no negative
      net-worth quarters remain. Source spreadsheet was completed and ingest re-run. No code change needed.

---

## 6. 🟡 Mobile-responsive layout ✅ DONE (Session 8)

- [x] Sidebar is now a slide-in drawer under `lg` with a hamburger top bar; static on desktop.
      Backdrop tap + route change close it. (`Sidebar.tsx`)
- [x] `layout.tsx` main padding made responsive (`p-4 sm:p-6 lg:p-8`) with top offset for the mobile bar.
- [x] Wide tables scroll horizontally: account history + debt summary already wrapped; added
      `overflow-x-auto` + `min-w` to the budget editor table.
- [x] Verified: markup renders, all routes 200, typecheck clean. (Eyeball at phone width to confirm feel.)

---

## 7. 🟢 Lower priority / nice-to-haves ✅ DONE (Session 8)

- [x] Data-freshness badge — sidebar footer "Data current to {latest transaction date}"
      (`getDataFreshness()` → `layout.tsx` → `Sidebar`). Surfaced that data is ~2 weeks behind.
- [x] Single source of truth for category colours — removed the unused `tailwind.config.ts`
      `category.*`/`surface.*` tokens; documented DB `colour` (primary) + `chartColors.ts` (fallback).
- [x] Consistent income/expense colour — new `<Amount>` component (inflow emerald / outflow neutral)
      applied across all transaction tables (Overview, Transactions, TransactionList).
- [x] Transactions: custom date-range filter (from/to inputs → `searchTransactions` start/endDate).
- [x] Transactions: flag toggle + inline note per row (columns already existed in schema; wired
      `updateTransactionFlag`/`updateTransactionNote` + server actions; flagged rows tinted amber).
- [x] Verified: date filter 13 vs 3,197; flag/note round-trip in DB; freshness badge renders; typecheck clean.

---

## Do NOT touch (working well)

- Visual system: slate-950/900/800 palette, `rounded-2xl` cards, `tabular-nums`, uppercase labels
- `lib/db.ts` query layer — clean, parameterised, well-typed
- Deep Dive default-state category grid + selector pattern
- Empty-state handling on Net Worth / Balance Sheet
