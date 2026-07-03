"""
Re-apply the current category rules to transactions already in the database.

Ingest only categorises rows it *inserts* — `INSERT OR IGNORE` drops duplicates
along with their freshly-computed category, so rules added after a transaction
was first ingested never reach it. This script closes that gap: it runs every
transaction back through the same resolver ingest uses
(`resolve_category`: merchant rule > description keyword > Frollo category map)
and updates the stored category when it changes.

By default it only touches transactions currently sitting in `Uncategorised`
(the common case — a backlog that predates its matching rules), so anything you
have already categorised is left untouched. Pass `--all` to re-resolve every
transaction (this *will* overwrite existing categories where a rule now matches).
Rows with `is_flagged = 1` are always left alone. A resolve that lands back on
Uncategorised never overwrites an existing category.

Idempotent — safe to re-run; a second run reports 0 updates.

Usage:
    python scripts/recategorise.py [--all] [--dry-run]
"""

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ingest_frollo import (
    build_category_lookup,
    load_category_map,
    load_rules_from_db,
    resolve_category,
    IngestStats,
)
from utils.db import get_connection, transaction
from utils.logger import get_logger

logger = get_logger("recategorise")


def recategorise(conn, only_uncategorised: bool, dry_run: bool) -> None:
    category_map = load_category_map()
    merchant_rules, description_rules = load_rules_from_db(conn)
    category_lookup = build_category_lookup(conn)
    stats = IngestStats()  # resolve_category records unmapped Frollo categories here

    uncat_row = conn.execute(
        "SELECT id FROM categories WHERE name = 'Uncategorised' AND parent_id IS NULL"
    ).fetchone()
    if uncat_row is None:
        logger.error("No 'Uncategorised' category found — aborting")
        sys.exit(1)
    uncategorised_id = uncat_row["id"]  # canonical sentinel resolve_category returns

    # Historically a duplicate child "Uncategorised > Uncategorised" was created,
    # and existing rows may point at it. Treat every category named 'Uncategorised'
    # as uncategorised for both selection and the "still uncategorised" guard.
    uncategorised_ids = {
        r["id"] for r in conn.execute("SELECT id FROM categories WHERE name = 'Uncategorised'")
    }

    logger.info("Loaded %d merchant + %d description rules",
                len(merchant_rules), len(description_rules))

    # We don't persist the Frollo category per transaction, so the map can only
    # be re-applied via merchant/description rules here. That is exactly the
    # backlog case (rules added after ingest); pass frollo_category=None below.
    # is_flagged rows are always left untouched.
    if only_uncategorised:
        placeholders = ",".join("?" * len(uncategorised_ids))
        query = ("SELECT id, description, merchant, category_id FROM transactions "
                 f"WHERE is_flagged = 0 AND category_id IN ({placeholders})")
        params: tuple = tuple(uncategorised_ids)
    else:
        query = ("SELECT id, description, merchant, category_id FROM transactions "
                 "WHERE is_flagged = 0")
        params = ()
    rows = conn.execute(query, params).fetchall()

    now = int(time.time())
    checked = updated = 0
    for row in rows:
        checked += 1
        new_cat, new_parent, is_transfer = resolve_category(
            None, row["merchant"], row["description"],
            category_map, merchant_rules, description_rules,
            category_lookup, uncategorised_id, stats,
        )
        if new_cat in uncategorised_ids or new_cat == row["category_id"]:
            continue
        updated += 1
        if dry_run:
            logger.info("[DRY RUN] #%d '%s' → category_id=%s%s",
                        row["id"], (row["description"] or "")[:40], new_cat,
                        " [TRANSFER]" if is_transfer else "")
        else:
            conn.execute(
                """
                UPDATE transactions
                SET category_id = ?, parent_category_id = ?, is_transfer = ?, updated_at = ?
                WHERE id = ?
                """,
                (new_cat, new_parent, 1 if is_transfer else 0, now, row["id"]),
            )

    logger.info("Recategorise complete — checked: %d | updated: %d%s",
                checked, updated, " (dry run)" if dry_run else "")


def main() -> None:
    parser = argparse.ArgumentParser(description="Re-apply category rules to existing transactions")
    parser.add_argument("--all", action="store_true",
                        help="Re-resolve every transaction, not just Uncategorised ones")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    conn = get_connection()
    try:
        if args.dry_run:
            recategorise(conn, only_uncategorised=not args.all, dry_run=True)
        else:
            with transaction(conn):
                recategorise(conn, only_uncategorised=not args.all, dry_run=False)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
