"""
conftest.py — set up test environment before any test module is imported.

The api-gateway service is designed to run inside Docker with a live PostgreSQL
database. To test pure Python helpers without any infrastructure, this conftest
stubs out just enough at the module level:
  - Sets DATABASE_URL so database.py doesn't raise on import
  - Replaces the SQLAlchemy engine/sessionmaker with no-ops
"""
import os
import sys
import types

# 1. Provide a dummy DATABASE_URL so database.py can parse the URL without
#    raising an error (the engine is never actually connected in these tests).
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")

# 2. Install a stub for the database module so the import chain doesn't try
#    to actually dial PostgreSQL.  The real module is bypassed; any test that
#    needs a session would require a different fixture anyway.
_db_stub = types.ModuleType("app.database")
_db_stub.get_db = lambda: None  # type: ignore[attr-defined]
_db_stub.SessionLocal = None  # type: ignore[attr-defined]
_db_stub.init_db = lambda: None  # type: ignore[attr-defined]
sys.modules["app.database"] = _db_stub
