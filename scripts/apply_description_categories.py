"""
Apply category changes from the uncategorised/transfers review CSV.

Reads the edited CSV which contains:
- Transaction IDs with new categories
- Keywords used to identify the category from the description

Actions:
1. Creates any new categories that don't exist
2. Updates transactions by ID
3. Extracts keyword rules and saves to config/description_rules.json
4. Applies keyword rules to any other matching transactions not in the CSV

Usage:
    python scripts/apply_description_categories.py [--file path/to/csv] [--dry-run]
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

logger = get_logger("apply_description_categories")

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
    Process the edited CSV. Returns description keyword rules for saving.
    """
    lookup = build_category_lookup(conn)
    keyword_rules: dict[str, dict] = {}
    total_updated = 0
    total_skipped = 0
    updated_ids: set[int] = set()

    # Pass 1: Read CSV, collect keyword rules, update specific transactions by ID
    rows_to_update: list[dict] = []
    with open(csv_path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            new_parent = (row.get("new_parent_category") or "").strip()
            new_child = (row.get("new_child_category") or "").strip()
            keyword = (row.get("keyword") or "").strip()

            if not new_parent or not new_child:
                total_skipped += 1
                continue

            rows_to_update.append(row)

            # Collect keyword rules
            if keyword:
                kw_lower = keyword.lower()
                if kw_lower not in keyword_rules:
                    keyword_rules[kw_lower] = {
                        "parent": new_parent,
                        "child": new_child,
                    }
                    if new_parent == TRANSFERS_PARENT and new_child == MONEY_TRANSFERS_CHILD:
                        keyword_rules[kw_lower]["is_transfer"] = True

    # Pass 2: Apply updates by transaction ID
    for row in rows_to_update:
        txn_id = int(float(row["id"]))
        new_parent = row["new_parent_category"].strip()
        new_child = row["new_child_category"].strip()

        category_id = ensure_category(conn, new_parent, new_child, lookup)
        parent_id = lookup[f"{new_parent}|"]
        is_transfer = 1 if (new_parent == TRANSFERS_PARENT and new_child == MONEY_TRANSFERS_CHILD) else 0

        if dry_run:
            logger.info(
                "[DRY RUN] Would update txn %d → %s > %s%s",
                txn_id, new_parent, new_child,
                " [TRANSFER]" if is_transfer else "",
            )
        else:
            conn.execute(
                """
                UPDATE transactions
                SET category_id = ?, parent_category_id = ?, is_transfer = ?, updated_at = unixepoch()
                WHERE id = ?
                """,
                (category_id, parent_id, is_transfer, txn_id),
            )
            total_updated += 1
            updated_ids.add(txn_id)

    # Pass 3: Apply keyword rules to OTHER transactions not already updated
    keyword_matched = 0
    for keyword, rule in keyword_rules.items():
        category_id = ensure_category(conn, rule["parent"], rule["child"], lookup)
        parent_id = lookup[f"{rule['parent']}|"]
        is_transfer = 1 if rule.get("is_transfer") else 0

        # Find transactions where description contains this keyword (case-insensitive)
        # but only uncategorised or money transfer transactions not already updated
        matching = conn.execute(
            """
            SELECT t.id FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN categories pc ON c.parent_id = pc.id
            WHERE LOWER(t.description) LIKE ?
              AND (
                  COALESCE(pc.name, c.name) = 'Uncategorised'
                  OR t.is_transfer = 1
              )
            """,
            (f"%{keyword}%",),
        ).fetchall()

        for match in matching:
            if match["id"] in updated_ids:
                continue

            if dry_run:
                logger.info(
                    "[DRY RUN] Keyword '%s' would also update txn %d → %s > %s",
                    keyword, match["id"], rule["parent"], rule["child"],
                )
            else:
                conn.execute(
                    """
                    UPDATE transactions
                    SET category_id = ?, parent_category_id = ?, is_transfer = ?, updated_at = unixepoch()
                    WHERE id = ?
                    """,
                    (category_id, parent_id, is_transfer, match["id"]),
                )
                keyword_matched += 1
                updated_ids.add(match["id"])

    logger.info(
        "Done — %d transactions updated by ID, %d additional by keyword match, %d rows skipped (no change)",
        total_updated, keyword_matched, total_skipped,
    )
    return keyword_rules


def save_description_rules(rules: dict[str, dict]) -> None:
    """Save/merge description keyword rules to config/description_rules.json."""
    rules_path = Path(__file__).parent.parent / "config" / "description_rules.json"

    existing: dict[str, dict] = {}
    if rules_path.exists():
        with open(rules_path, encoding="utf-8") as f:
            existing = json.load(f)

    existing.update(rules)

    with open(rules_path, "w", encoding="utf-8") as f:
        json.dump(existing, f, indent=2, ensure_ascii=False)
        f.write("\n")

    logger.info("Saved %d description keyword rules to %s", len(existing), rules_path.name)


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply description-based category changes")
    parser.add_argument(
        "--file", type=Path,
        default=Path(__file__).parent.parent / "data" / "uncategorised_and_transfers edited.csv",
        help="Path to the edited CSV",
    )
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing to DB")
    args = parser.parse_args()

    if not args.file.exists():
        logger.error("CSV not found: %s", args.file)
        sys.exit(1)

    conn = get_connection()
    try:
        if args.dry_run:
            keyword_rules = apply_csv(conn, args.file, dry_run=True)
            logger.info("[DRY RUN] Would save %d keyword rules", len(keyword_rules))
        else:
            with transaction(conn):
                keyword_rules = apply_csv(conn, args.file, dry_run=False)
            save_description_rules(keyword_rules)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
