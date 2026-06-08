"""
Frollo CSV ingest script.

Parses all CSV files in the Frollo export directory, deduplicates against
the database, and inserts new transactions.

Usage:
    python scripts/ingest_frollo.py [--file path/to/specific.csv]

Frollo CSV columns (confirmed format as of 2026-06):
    transaction_id, description, user_description, amount, currency,
    transaction_date, posted_date, account_number, account_name,
    credit_debit, transaction_type, provider_name, merchant_name,
    budget_category, category_name, user_tags, notes, included

The script is safe to re-run on the same files — deduplication is enforced
at the database level via a unique index on (account_id, date, amount, description).
"""

import argparse
import csv
import json
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent))

from utils.db import get_connection, transaction
from utils.logger import get_logger

logger = get_logger("ingest_frollo")


# ── Data structures ───────────────────────────────────────────────────────────

@dataclass
class FrolloRow:
    date: str
    posted_date: Optional[str]
    amount_cents: int
    description: str
    merchant: Optional[str]
    frollo_category: Optional[str]
    transaction_type: Optional[str]
    account_name: str
    account_number: Optional[str]
    notes: Optional[str]
    tags: Optional[str]
    transaction_id: Optional[str]


@dataclass
class IngestStats:
    rows_read: int = 0
    rows_inserted: int = 0
    rows_skipped_duplicate: int = 0
    rows_skipped_error: int = 0
    new_accounts: list[str] = field(default_factory=list)
    unmapped_categories: set[str] = field(default_factory=set)


# ── Category mapping ──────────────────────────────────────────────────────────

def load_category_map() -> dict:
    """Load the Frollo → Finboard category mapping from config/categories.json."""
    config_path = Path(__file__).parent.parent / "config" / "categories.json"
    with open(config_path, encoding="utf-8") as f:
        return json.load(f)


def load_merchant_rules() -> dict:
    """Load merchant → category rules from config/merchant_rules.json (if it exists)."""
    rules_path = Path(__file__).parent.parent / "config" / "merchant_rules.json"
    if rules_path.exists():
        with open(rules_path, encoding="utf-8") as f:
            return json.load(f)
    return {}


def load_description_rules() -> dict:
    """Load description keyword → category rules from config/description_rules.json (if it exists)."""
    rules_path = Path(__file__).parent.parent / "config" / "description_rules.json"
    if rules_path.exists():
        with open(rules_path, encoding="utf-8") as f:
            return json.load(f)
    return {}


def _resolve_mapping(
    mapping: dict,
    category_lookup: dict[str, int],
    uncategorised_id: int,
) -> tuple[Optional[int], Optional[int], bool]:
    """Resolve a category mapping dict to (category_id, parent_category_id, is_transfer)."""
    is_transfer = mapping.get("is_transfer", False)
    parent_name = mapping.get("parent")
    child_name = mapping.get("child")

    parent_id = category_lookup.get(f"{parent_name}|") if parent_name else None

    if child_name:
        child_id = category_lookup.get(f"{parent_name}|{child_name}")
        return child_id or parent_id or uncategorised_id, parent_id, is_transfer
    else:
        return parent_id or uncategorised_id, None, is_transfer


def _match_description_rule(
    description: str,
    description_rules: dict,
) -> Optional[dict]:
    """Check if any keyword rule matches the description (case-insensitive). Returns the rule or None."""
    desc_lower = description.lower()
    for keyword, rule in description_rules.items():
        if keyword in desc_lower:
            return rule
    return None


def resolve_category(
    frollo_category: Optional[str],
    merchant: Optional[str],
    description: str,
    category_map: dict,
    merchant_rules: dict,
    description_rules: dict,
    category_lookup: dict[str, int],
    uncategorised_id: int,
    stats: IngestStats,
) -> tuple[Optional[int], Optional[int], bool]:
    """
    Map a transaction to (category_id, parent_category_id, is_transfer).
    Priority: merchant rules > description keyword rules > Frollo category mapping.
    """
    # 1. Merchant rules override everything
    if merchant and merchant in merchant_rules:
        return _resolve_mapping(merchant_rules[merchant], category_lookup, uncategorised_id)

    # 2. Description keyword rules (for raw card descriptions where merchant is Unknown)
    desc_rule = _match_description_rule(description, description_rules)
    if desc_rule:
        return _resolve_mapping(desc_rule, category_lookup, uncategorised_id)

    # 3. Frollo category mapping
    if not frollo_category:
        return uncategorised_id, None, False

    mapping = category_map.get(frollo_category)
    if mapping is None:
        if frollo_category not in stats.unmapped_categories:
            logger.warning("Unmapped Frollo category: '%s' → Uncategorised", frollo_category)
        stats.unmapped_categories.add(frollo_category)
        return uncategorised_id, None, False

    return _resolve_mapping(mapping, category_lookup, uncategorised_id)


# ── Account helpers ───────────────────────────────────────────────────────────

def get_or_create_account(conn, account_name: str, account_number: Optional[str], stats: IngestStats) -> int:
    """Look up an account by name, creating it if it doesn't exist."""
    row = conn.execute(
        "SELECT id FROM accounts WHERE name = ? AND source = 'frollo'",
        (account_name,),
    ).fetchone()

    if row:
        return row["id"]

    account_type = _infer_account_type(account_name)
    now = int(time.time())
    conn.execute(
        """
        INSERT INTO accounts (name, institution, account_type, currency, source, external_id, created_at)
        VALUES (?, ?, ?, 'AUD', 'frollo', ?, ?)
        """,
        (account_name, _infer_institution(account_name), account_type, account_number, now),
    )
    stats.new_accounts.append(account_name)
    logger.info("Created account: %s (%s)", account_name, account_type)
    return conn.execute(
        "SELECT id FROM accounts WHERE name = ? AND source = 'frollo'", (account_name,)
    ).fetchone()["id"]


def _infer_institution(account_name: str) -> str:
    name_lower = account_name.lower()
    if "anz" in name_lower:
        return "ANZ"
    if "hsbc" in name_lower:
        return "HSBC"
    if "commonwealth" in name_lower or "cba" in name_lower:
        return "CBA"
    if "westpac" in name_lower:
        return "Westpac"
    if "nab" in name_lower:
        return "NAB"
    return "Unknown"


def _infer_account_type(account_name: str) -> str:
    name_lower = account_name.lower()
    if any(k in name_lower for k in ("credit", "card", "visa", "mastercard")):
        return "credit_card"
    if any(k in name_lower for k in ("saver", "savings", "offset")):
        return "savings"
    if any(k in name_lower for k in ("loan", "mortgage", "home loan")):
        return "loan"
    return "transaction"


# ── CSV parsing ───────────────────────────────────────────────────────────────

# Known column name variants across Frollo export versions
_COL_MAP = {
    "date":             ["transaction_date", "Date", "Transaction Date", "date"],
    "posted_date":      ["posted_date", "Posted Date"],
    "amount":           ["amount", "Amount"],
    "description":      ["description", "Description", "Transaction Description"],
    "merchant":         ["merchant_name", "Merchant Name", "Merchant", "merchant"],
    "category":         ["category_name", "Category", "category", "Frollo Category"],
    "transaction_type": ["transaction_type"],
    "account_name":     ["account_name", "Account Name", "Account"],
    "account_number":   ["account_number", "Account Number", "BSB/Account Number"],
    "note":             ["notes", "Note", "Notes", "note"],
    "tags":             ["user_tags", "Tags", "tags"],
    "transaction_id":   ["transaction_id", "Transaction ID", "ID"],
    "included":         ["included"],
}


def _find_col(header: list[str], candidates: list[str]) -> Optional[str]:
    for c in candidates:
        if c in header:
            return c
    return None


def parse_csv(path: Path) -> list[FrolloRow]:
    """Parse a Frollo CSV export into a list of FrolloRow objects."""
    rows: list[FrolloRow] = []

    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            logger.error("Empty or unreadable CSV: %s", path)
            return rows

        header = list(reader.fieldnames)
        cols = {key: _find_col(header, candidates) for key, candidates in _COL_MAP.items()}

        missing_required = [k for k in ("date", "amount", "description", "account_name") if cols[k] is None]
        if missing_required:
            logger.error(
                "CSV %s missing required columns: %s (found: %s)",
                path.name, missing_required, header,
            )
            return rows

        for line_num, raw in enumerate(reader, start=2):
            try:
                # Skip rows explicitly excluded by Frollo
                if cols["included"] and raw.get(cols["included"], "true").strip().lower() == "false":
                    continue

                date_str = _parse_date(raw.get(cols["date"], "").strip())
                amount_cents = _parse_amount(raw.get(cols["amount"], "").strip())
                description = raw.get(cols["description"], "").strip()
                account_name = raw.get(cols["account_name"], "").strip()

                if not date_str or amount_cents is None or not description or not account_name:
                    logger.warning("Line %d: missing required field — skipping", line_num)
                    continue

                posted_date_str = None
                if cols["posted_date"]:
                    posted_date_str = _parse_date(raw.get(cols["posted_date"], "").strip())

                rows.append(FrolloRow(
                    date=date_str,
                    posted_date=posted_date_str,
                    amount_cents=amount_cents,
                    description=description,
                    merchant=_get_optional(raw, cols["merchant"]),
                    frollo_category=_get_optional(raw, cols["category"]),
                    transaction_type=_get_optional(raw, cols["transaction_type"]),
                    account_name=account_name,
                    account_number=_get_optional(raw, cols["account_number"]),
                    notes=_get_optional(raw, cols["note"]),
                    tags=_get_optional(raw, cols["tags"]),
                    transaction_id=_get_optional(raw, cols["transaction_id"]),
                ))
            except Exception as exc:
                logger.warning("Line %d: parse error (%s) — skipping", line_num, exc)

    return rows


def _get_optional(row: dict, col: Optional[str]) -> Optional[str]:
    if col is None:
        return None
    val = row.get(col, "").strip()
    return val if val else None


def _parse_date(raw: str) -> Optional[str]:
    """Parse various date formats into YYYY-MM-DD."""
    if not raw:
        return None
    from datetime import datetime

    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(raw, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _parse_amount(raw: str) -> Optional[int]:
    """
    Parse an amount string to integer cents.
    Frollo exports amounts as signed decimals: '-45.00' or '5000.00'.
    """
    if not raw:
        return None
    cleaned = raw.replace("$", "").replace(",", "").strip()
    try:
        return round(float(cleaned) * 100)
    except ValueError:
        return None


# ── Main ingest logic ─────────────────────────────────────────────────────────

def build_category_lookup(conn) -> dict[str, int]:
    """Return {'ParentName|ChildName': id, 'ParentName|': parent_id, ...}."""
    rows = conn.execute(
        "SELECT c.id, c.name, c.parent_id, p.name AS parent_name FROM categories c LEFT JOIN categories p ON c.parent_id = p.id"
    ).fetchall()
    lookup: dict[str, int] = {}
    for row in rows:
        if row["parent_id"] is None:
            lookup[f"{row['name']}|"] = row["id"]
        else:
            lookup[f"{row['parent_name']}|{row['name']}"] = row["id"]
    return lookup


def ingest_file(conn, path: Path, category_map: dict, merchant_rules: dict, description_rules: dict, stats: IngestStats) -> None:
    """Ingest a single Frollo CSV file into the database."""
    logger.info("Processing: %s", path.name)
    rows = parse_csv(path)

    if not rows:
        logger.warning("No rows parsed from %s", path.name)
        return

    category_lookup = build_category_lookup(conn)
    uncategorised_row = conn.execute(
        "SELECT id FROM categories WHERE name = 'Uncategorised' AND parent_id IS NULL"
    ).fetchone()
    uncategorised_id = uncategorised_row["id"] if uncategorised_row else None

    now = int(time.time())

    for row in rows:
        stats.rows_read += 1
        try:
            account_id = get_or_create_account(conn, row.account_name, row.account_number, stats)
            category_id, parent_category_id, is_transfer = resolve_category(
                row.frollo_category, row.merchant, row.description,
                category_map, merchant_rules, description_rules,
                category_lookup, uncategorised_id, stats,
            )

            # transaction_type = transfer_incoming / transfer_outgoing overrides category mapping
            if row.transaction_type in ("transfer_incoming", "transfer_outgoing"):
                is_transfer = True

            is_pending = 1 if row.posted_date is None else 0
            posted_date = row.posted_date

            conn.execute(
                """
                INSERT OR IGNORE INTO transactions (
                    account_id, transaction_date, posted_date, amount_cents,
                    description, merchant, category_id, parent_category_id,
                    is_transfer, is_pending, notes, tags, source, source_id,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'frollo', ?, ?, ?)
                """,
                (
                    account_id, row.date, posted_date, row.amount_cents,
                    row.description, row.merchant, category_id, parent_category_id,
                    1 if is_transfer else 0, is_pending, row.notes, row.tags,
                    row.transaction_id, now, now,
                ),
            )
            changes = conn.execute("SELECT changes()").fetchone()[0]
            if changes:
                stats.rows_inserted += 1
            else:
                stats.rows_skipped_duplicate += 1

        except Exception as exc:
            logger.error("Row error for '%s' on %s: %s", row.description, row.date, exc)
            stats.rows_skipped_error += 1


def get_export_dir() -> Path:
    path = os.environ.get("FROLLO_EXPORT_DIR")
    if path:
        return Path(path)
    return Path(__file__).parent.parent / "data" / "exports" / "frollo"


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest Frollo CSV exports into Finboard")
    parser.add_argument("--file", type=Path, help="Path to a specific CSV file (default: all in export dir)")
    args = parser.parse_args()

    category_map = load_category_map()
    merchant_rules = load_merchant_rules()
    description_rules = load_description_rules()
    conn = get_connection()
    stats = IngestStats()

    if merchant_rules:
        logger.info("Loaded %d merchant rules", len(merchant_rules))
    if description_rules:
        logger.info("Loaded %d description keyword rules", len(description_rules))

    try:
        if args.file:
            files = [args.file]
        else:
            export_dir = get_export_dir()
            if not export_dir.exists():
                logger.error("Export directory not found: %s", export_dir)
                sys.exit(1)
            files = sorted(export_dir.glob("*.csv"))
            if not files:
                logger.warning("No CSV files found in %s", export_dir)
                sys.exit(0)

        logger.info("Found %d file(s) to process", len(files))

        with transaction(conn):
            for csv_path in files:
                ingest_file(conn, csv_path, category_map, merchant_rules, description_rules, stats)

    finally:
        conn.close()

    logger.info(
        "Ingest complete — read: %d | inserted: %d | duplicates: %d | errors: %d",
        stats.rows_read, stats.rows_inserted, stats.rows_skipped_duplicate, stats.rows_skipped_error,
    )
    if stats.new_accounts:
        logger.info("New accounts created: %s", ", ".join(stats.new_accounts))
    if stats.unmapped_categories:
        logger.warning(
            "Unmapped Frollo categories (→ Uncategorised): %s",
            ", ".join(sorted(stats.unmapped_categories)),
        )


if __name__ == "__main__":
    main()
