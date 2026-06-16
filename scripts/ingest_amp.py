"""
AMP CSV ingest script.

Parses AMP transaction history CSVs and inserts into the database.
AMP CSVs have a few header lines before the actual data starts at
the row beginning with "Date,Description,Amount,Balance,Receipt number".

Category rules:
- Rows with "Transfer" in the description → Transfers > Money Transfers (is_transfer=1)
- Rows with "Withdrawal Direct Debit" → Property > Mortgage
- Everything else → Uncategorised

The script is safe to re-run — deduplication via unique index on
(account_id, transaction_date, amount_cents, description).

Usage:
    python scripts/ingest_amp.py [--file path/to/specific.csv] [--dry-run]
"""

import argparse
import csv
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent))

from utils.db import get_connection, transaction
from utils.logger import get_logger

logger = get_logger("ingest_amp")

ACCOUNT_NAME = "AMP Mortgage Offset"
INSTITUTION = "AMP"
SOURCE = "amp"


def parse_date(raw: str) -> Optional[str]:
    """Parse AMP date format (DD-Mon-YY) to YYYY-MM-DD."""
    if not raw:
        return None
    for fmt in ("%d-%b-%y", "%d-%b-%Y", "%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(raw.strip(), fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_amount(raw: str) -> Optional[int]:
    """Parse dollar amount string to integer cents. e.g. '-$5000.0000' → -500000."""
    if not raw:
        return None
    cleaned = raw.strip().replace("$", "").replace(",", "")
    try:
        return round(float(cleaned) * 100)
    except ValueError:
        return None


def categorise(description: str, category_lookup: dict[str, int]) -> tuple[int, Optional[int], bool]:
    """
    Determine category for an AMP transaction.
    Returns (category_id, parent_category_id, is_transfer).
    """
    desc_lower = description.lower()

    # Transfer → Transfers > Money Transfers
    if "transfer" in desc_lower:
        cat_id = category_lookup.get("Transfers|Money Transfers")
        parent_id = category_lookup.get("Transfers|")
        if cat_id and parent_id:
            return cat_id, parent_id, True

    # Withdrawal Direct Debit → Property > Mortgage
    if "withdrawal direct debit" in desc_lower:
        cat_id = category_lookup.get("Property|Mortgage")
        parent_id = category_lookup.get("Property|")
        if cat_id and parent_id:
            return cat_id, parent_id, False

    # Fallback to Uncategorised
    uncat_id = category_lookup.get("Uncategorised|Uncategorised") or category_lookup.get("Uncategorised|")
    return uncat_id or 0, None, False


def build_category_lookup(conn) -> dict[str, int]:
    """Return {'ParentName|ChildName': id, 'ParentName|': parent_id, ...}."""
    rows = conn.execute(
        "SELECT c.id, c.name, c.parent_id, p.name AS parent_name "
        "FROM categories c LEFT JOIN categories p ON c.parent_id = p.id"
    ).fetchall()
    lookup: dict[str, int] = {}
    for row in rows:
        if row["parent_id"] is None:
            lookup[f"{row['name']}|"] = row["id"]
        else:
            lookup[f"{row['parent_name']}|{row['name']}"] = row["id"]
    return lookup


def get_or_create_account(conn, account_name: str) -> int:
    """Look up the AMP account, creating if needed."""
    row = conn.execute(
        "SELECT id FROM accounts WHERE name = ? AND source = ?",
        (account_name, SOURCE),
    ).fetchone()

    if row:
        return row["id"]

    now = int(time.time())
    conn.execute(
        """
        INSERT INTO accounts (name, institution, account_type, currency, source, created_at)
        VALUES (?, ?, 'savings', 'AUD', ?, ?)
        """,
        (account_name, INSTITUTION, SOURCE, now),
    )
    logger.info("Created account: %s (%s)", account_name, INSTITUTION)
    return conn.execute(
        "SELECT id FROM accounts WHERE name = ? AND source = ?", (account_name, SOURCE)
    ).fetchone()["id"]


def find_data_start(path: Path) -> int:
    """Find the line number where the CSV data header starts (Date,Description,...)."""
    with open(path, encoding="utf-8-sig") as f:
        for i, line in enumerate(f):
            if line.strip().startswith("Date,Description"):
                return i
    return -1


def parse_amp_csv(path: Path) -> list[dict]:
    """Parse an AMP CSV, skipping header metadata rows."""
    data_start = find_data_start(path)
    if data_start < 0:
        logger.error("Could not find data header in %s", path.name)
        return []

    rows = []
    with open(path, encoding="utf-8-sig") as f:
        # Skip to data header
        for _ in range(data_start):
            next(f)
        reader = csv.DictReader(f)
        for line_num, raw in enumerate(reader, start=data_start + 2):
            date_str = parse_date(raw.get("Date", ""))
            amount_cents = parse_amount(raw.get("Amount", ""))
            description = (raw.get("Description") or "").strip()
            receipt = (raw.get("Receipt number") or "").strip()

            if not date_str or amount_cents is None or not description:
                logger.warning("Line %d: missing required field — skipping", line_num)
                continue

            rows.append({
                "date": date_str,
                "amount_cents": amount_cents,
                "description": description,
                "receipt": receipt,
            })

    return rows


def ingest_file(conn, path: Path, dry_run: bool) -> dict:
    """Ingest a single AMP CSV file. Returns stats dict."""
    logger.info("Processing: %s", path.name)
    stats = {"read": 0, "inserted": 0, "duplicates": 0, "errors": 0}

    rows = parse_amp_csv(path)
    if not rows:
        logger.warning("No rows parsed from %s", path.name)
        return stats

    account_id = get_or_create_account(conn, ACCOUNT_NAME)
    category_lookup = build_category_lookup(conn)
    now = int(time.time())

    for row in rows:
        stats["read"] += 1
        try:
            category_id, parent_category_id, is_transfer = categorise(row["description"], category_lookup)

            # Derive merchant from description
            desc = row["description"]
            if "transfer" in desc.lower():
                merchant = "AMP Transfer"
            elif "withdrawal direct debit" in desc.lower():
                merchant = "AMP Mortgage"
            elif "direct entry credit" in desc.lower():
                merchant = "AMP Direct Credit"
            else:
                merchant = "AMP"

            if dry_run:
                cat_name = "transfer" if is_transfer else f"cat_id={category_id}"
                logger.info("[DRY RUN] %s | %s | %d cents | %s", row["date"], desc, row["amount_cents"], cat_name)
                stats["inserted"] += 1
                continue

            conn.execute(
                """
                INSERT OR IGNORE INTO transactions (
                    account_id, transaction_date, posted_date, amount_cents,
                    description, merchant, category_id, parent_category_id,
                    is_transfer, is_pending, notes, tags, source, source_id,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, ?, ?, ?)
                """,
                (
                    account_id, row["date"], row["date"], row["amount_cents"],
                    desc, merchant, category_id, parent_category_id,
                    1 if is_transfer else 0,
                    SOURCE, row["receipt"],
                    now, now,
                ),
            )
            changes = conn.execute("SELECT changes()").fetchone()[0]
            if changes:
                stats["inserted"] += 1
            else:
                stats["duplicates"] += 1

        except Exception as exc:
            logger.error("Row error for '%s' on %s: %s", row["description"], row["date"], exc)
            stats["errors"] += 1

    return stats


def get_export_dir() -> Path:
    path = os.environ.get("AMP_EXPORT_DIR")
    if path:
        return Path(path)
    return Path(__file__).parent.parent / "data" / "exports" / "amp"


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest AMP transaction history CSVs into Finboard")
    parser.add_argument("--file", type=Path, help="Path to a specific CSV file (default: all in export dir)")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing to DB")
    args = parser.parse_args()

    conn = get_connection()
    total_stats = {"read": 0, "inserted": 0, "duplicates": 0, "errors": 0}

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

        if args.dry_run:
            for csv_path in files:
                stats = ingest_file(conn, csv_path, dry_run=True)
                for k in total_stats:
                    total_stats[k] += stats[k]
        else:
            with transaction(conn):
                for csv_path in files:
                    stats = ingest_file(conn, csv_path, dry_run=False)
                    for k in total_stats:
                        total_stats[k] += stats[k]

    finally:
        conn.close()

    logger.info(
        "Ingest complete — read: %d | inserted: %d | duplicates: %d | errors: %d",
        total_stats["read"], total_stats["inserted"], total_stats["duplicates"], total_stats["errors"],
    )


if __name__ == "__main__":
    main()
