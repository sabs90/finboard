"""
Apply category changes from the reviewed CSV.

Reads category_review.csv (edited by user), then:
1. Creates any new categories that don't already exist
2. Updates all matching transactions to the new category
3. Sets is_transfer=1 for transactions assigned to "Money Transfers"
4. Writes merchant → category rules to config/merchant_rules.json for future ingests

Usage:
    python scripts/apply_categories.py [--file path/to/category_review.csv] [--dry-run]
"""

import argparse
import csv
import json
import sys
import time
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent))

from utils.db import get_connection, transaction
from utils.logger import get_logger

logger = get_logger("apply_categories")


TRANSFERS_PARENT = "Transfers"
MONEY_TRANSFERS_CHILD = "Money Transfers"


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


def ensure_category(conn, parent_name: str, child_name: str, lookup: dict[str, int]) -> int:
    """Create parent and/or child category if they don't exist. Returns child category_id."""
    parent_key = f"{parent_name}|"
    if parent_key not in lookup:
        now = int(time.time())
        conn.execute(
            "INSERT INTO categories (name, parent_id, sort_order, is_active) VALUES (?, NULL, 99, 1)",
            (parent_name,),
        )
        parent_id = conn.execute(
            "SELECT id FROM categories WHERE name = ? AND parent_id IS NULL", (parent_name,)
        ).fetchone()["id"]
        lookup[parent_key] = parent_id
        logger.info("Created new parent category: %s (id=%d)", parent_name, parent_id)
    else:
        parent_id = lookup[parent_key]

    child_key = f"{parent_name}|{child_name}"
    if child_key not in lookup:
        conn.execute(
            "INSERT INTO categories (name, parent_id, sort_order, is_active) VALUES (?, ?, 99, 1)",
            (child_name, parent_id),
        )
        child_id = conn.execute(
            "SELECT id FROM categories WHERE name = ? AND parent_id = ?", (child_name, parent_id)
        ).fetchone()["id"]
        lookup[child_key] = child_id
        logger.info("Created new child category: %s > %s (id=%d)", parent_name, child_name, child_id)
    else:
        child_id = lookup[child_key]

    return child_id


def apply_csv(conn, csv_path: Path, dry_run: bool) -> dict[str, dict]:
    """
    Process the edited CSV. Returns merchant_rules for writing to JSON.
    """
    lookup = build_category_lookup(conn)
    merchant_rules: dict[str, dict] = {}
    total_updated = 0
    total_skipped = 0

    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)

        for line_num, row in enumerate(reader, start=2):
            new_parent = row.get("new_parent_category", "").strip()
            new_child = row.get("new_child_category", "").strip()

            if not new_parent or not new_child:
                total_skipped += 1
                continue

            merchant = row["merchant"].strip()
            current_parent = row.get("current_parent_category", "").strip()
            current_child = row.get("current_child_category", "").strip()

            if new_parent == current_parent and new_child == current_child:
                total_skipped += 1
                continue

            category_id = ensure_category(conn, new_parent, new_child, lookup)
            parent_id = lookup[f"{new_parent}|"]
            is_transfer = 1 if (new_parent == TRANSFERS_PARENT and new_child == MONEY_TRANSFERS_CHILD) else 0

            if dry_run:
                logger.info(
                    "[DRY RUN] Would update merchant '%s': %s > %s → %s > %s (is_transfer=%d)",
                    merchant, current_parent, current_child, new_parent, new_child, is_transfer,
                )
            else:
                result = conn.execute(
                    """
                    UPDATE transactions
                    SET category_id = ?,
                        parent_category_id = ?,
                        is_transfer = ?,
                        updated_at = unixepoch()
                    WHERE merchant = ?
                      AND COALESCE(category_id, 0) = COALESCE(
                          (SELECT c.id FROM categories c
                           LEFT JOIN categories pc ON c.parent_id = pc.id
                           WHERE c.name = ? AND COALESCE(pc.name, '') = COALESCE(?, '')),
                          0)
                    """,
                    (category_id, parent_id, is_transfer, merchant, current_child, current_parent),
                )
                count = result.rowcount
                total_updated += count
                logger.info(
                    "Updated %d txns for '%s': %s > %s → %s > %s%s",
                    count, merchant, current_parent, current_child,
                    new_parent, new_child,
                    " [TRANSFER]" if is_transfer else "",
                )

            merchant_rules[merchant] = {
                "parent": new_parent,
                "child": new_child,
            }
            if is_transfer:
                merchant_rules[merchant]["is_transfer"] = True

    logger.info(
        "Done — %d transactions updated, %d rows skipped (no change)",
        total_updated, total_skipped,
    )
    return merchant_rules


def save_merchant_rules(rules: dict[str, dict]) -> None:
    """Save/merge merchant rules to config/merchant_rules.json."""
    rules_path = Path(__file__).parent.parent / "config" / "merchant_rules.json"

    existing: dict[str, dict] = {}
    if rules_path.exists():
        with open(rules_path, encoding="utf-8") as f:
            existing = json.load(f)

    existing.update(rules)

    with open(rules_path, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)
        f.write("\n")

    logger.info("Saved %d merchant rules to %s", len(existing), rules_path.name)


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply category changes from reviewed CSV")
    parser.add_argument(
        "--file", type=Path,
        default=Path(__file__).parent.parent / "data" / "category_review.csv",
        help="Path to the edited category review CSV",
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing to DB")
    args = parser.parse_args()

    if not args.file.exists():
        logger.error("CSV not found: %s", args.file)
        sys.exit(1)

    conn = get_connection()
    try:
        if args.dry_run:
            merchant_rules = apply_csv(conn, args.file, dry_run=True)
            logger.info("[DRY RUN] Would save %d merchant rules", len(merchant_rules))
        else:
            with transaction(conn):
                merchant_rules = apply_csv(conn, args.file, dry_run=False)
            save_merchant_rules(merchant_rules)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
