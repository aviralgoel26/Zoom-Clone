"""
view_db.py
----------
Helper script to neatly view all tables and records in sql_app.db.
Usage:
    python view_db.py
"""

import sqlite3

def view_database():
    conn = sqlite3.connect("sql_app.db")
    cursor = conn.cursor()

    # Get list of tables
    tables = [row[0] for row in cursor.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]

    print("=" * 60)
    print(" SQLITE DATABASE BROWSER: sql_app.db")
    print("=" * 60)

    for table in tables:
        if table.startswith("sqlite_"):
            continue

        columns = [row[1] for row in cursor.execute(f"PRAGMA table_info({table})").fetchall()]
        rows = cursor.execute(f"SELECT * FROM {table}").fetchall()

        print(f"\nTABLE: {table} ({len(rows)} rows)")
        print("-" * 60)
        print(" | ".join(columns))
        print("-" * 60)
        for row in rows:
            print(" | ".join(str(val) for val in row))
        if not rows:
            print(" (Empty table)")

    conn.close()

if __name__ == "__main__":
    view_database()
