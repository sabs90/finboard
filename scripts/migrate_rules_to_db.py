"""
Migrate category rules from the legacy JSON config files into the
`category_rules` SQLite table (the new single source of truth).

Reads:
  - config/merchant_rules.json     → rule_type='merchant'  (exact merchant match)
  - config/description_rules.json  → rule_type='description' (keyword substring)

For each rule it ensures the parent/child category exists, then upserts a row
into category_rules. Idempotent — safe to re-run. The JSON files are left in
place as a backup; the ingest scripts no longer read them.

Usage:
    python scripts/migrate_rules_to_db.py [--dry-run]
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from utils.db import get_connection, transaction
from utils.logger import get_logger

logger = get_logger("migrate_rules_to_db")

CONFIG_DIR = Path(__file__).parent.parent / "config"
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
    """Create parent and/or child category if missing. Returns child category_id."""
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
        logger.info("Created parent category: %s (id=%d)", parent_name, parent_id)
    else:
        parent_id = lookup[parent_key]

    if not child_name:
        return parent_id

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
        logger.info("Created child category: %s > %s (id=%d)", parent_name, child_name, child_id)
    else:
        child_id = lookup[child_key]

    return child_id


def load_json(name: str) -> dict:
    path = CONFIG_DIR / name
    if not path.exists():
        logger.warning("Rule file not found, skipping: %s", name)
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def upsert_rule(conn, rule_type: str, pattern: str, category_id: int, is_transfer: int) -> None:
    conn.execute(
        """
        INSERT INTO category_rules (rule_type, pattern, category_id, is_transfer, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'migrated', unixepoch(), unixepoch())
        ON CONFLICT(rule_type, pattern) DO UPDATE SET
            category_id = excluded.category_id,
            is_transfer = excluded.is_transfer,
            updated_at  = unixepoch()
        """,
        (rule_type, pattern, category_id, is_transfer),
    )


def migrate(conn, dry_run: bool) -> None:
    lookup = build_category_lookup(conn)
    merchant_rules = load_json("merchant_rules.json")
    description_rules = load_json("description_rules.json")

    counts = {"merchant": 0, "description": 0}

    for rule_type, rules in (("merchant", merchant_rules), ("description", description_rules)):
        for pattern, rule in rules.items():
            parent = (rule.get("parent") or "").strip()
            child = (rule.get("child") or "").strip()
            if not parent:
                logger.warning("Skipping %s rule '%s' — no parent category", rule_type, pattern)
                continue
            # Description patterns match case-insensitively; store lowercase.
            stored_pattern = pattern.lower() if rule_type == "description" else pattern
            is_transfer = 1 if rule.get("is_transfer") else 0
            # Belt-and-braces: Transfers > Money Transfers is always a transfer.
            if parent == TRANSFERS_PARENT and child == MONEY_TRANSFERS_CHILD:
                is_transfer = 1

            if dry_run:
                logger.info("[DRY RUN] %s '%s' → %s%s%s", rule_type, stored_pattern, parent,
                            f" > {child}" if child else "", " [TRANSFER]" if is_transfer else "")
            else:
                category_id = ensure_category(conn, parent, child, lookup)
                upsert_rule(conn, rule_type, stored_pattern, category_id, is_transfer)
            counts[rule_type] += 1

    logger.info("Migrated %d merchant + %d description rules%s",
                counts["merchant"], counts["description"], " (dry run)" if dry_run else "")


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate JSON category rules into the category_rules table")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    conn = get_connection()
    try:
        if args.dry_run:
            migrate(conn, dry_run=True)
        else:
            with transaction(conn):
                migrate(conn, dry_run=False)
            total = conn.execute("SELECT COUNT(*) AS n FROM category_rules").fetchone()["n"]
            logger.info("category_rules now holds %d rules", total)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
