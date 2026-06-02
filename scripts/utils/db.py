"""Shared SQLite connection helper for all Finboard ingest scripts."""

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Generator


def get_db_path() -> Path:
    """Resolve DB path from environment, with a sensible local default."""
    path = os.environ.get("DB_PATH")
    if path:
        return Path(path)
    return Path(__file__).parent.parent.parent / "data" / "finance.db"


def get_connection() -> sqlite3.Connection:
    """Open a WAL-mode SQLite connection with foreign keys enforced."""
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def transaction(conn: sqlite3.Connection) -> Generator[sqlite3.Connection, None, None]:
    """Context manager that commits on success and rolls back on exception."""
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
