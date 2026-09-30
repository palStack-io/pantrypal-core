"""
Postgres-backed fixtures (same shape as pantrypal_premium's tests/pg/conftest.py).

The parent tests/conftest.py stubs app.database so pure-unit tests need no
infrastructure. These tests need the real thing, so this removes the stub and
points SQLAlchemy at PG_TEST_URL. With no reachable database the directory is
skipped, so a plain `pytest tests/` still passes on a laptop.
"""
import os
import sys
import uuid

import pytest
from sqlalchemy import text

PG_URL = os.environ.get("PG_TEST_URL", "")


@pytest.fixture(scope="session")
def pg_engine():
    if not PG_URL:
        pytest.skip("PG_TEST_URL not set")

    from sqlalchemy import create_engine
    engine = create_engine(PG_URL, pool_pre_ping=True)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:                      # unreachable DB -> skip, don't fail
        pytest.skip(f"Postgres not reachable at PG_TEST_URL: {exc}")

    for name in list(sys.modules):
        if name == "app.database" or name.startswith("app.routes"):
            del sys.modules[name]
    os.environ["DATABASE_URL"] = PG_URL

    from app.models import Base
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db(pg_engine):
    """A session in a transaction that is always rolled back, even if the code under test commits."""
    from sqlalchemy.orm import sessionmaker

    connection = pg_engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection, join_transaction_mode="create_savepoint")()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def make_user():
    def _make(db):
        from app.models import User
        uid = str(uuid.uuid4())
        user = User(id=uid, username=f"u_{uid[:8]}", email=f"{uid[:8]}@example.com", password_hash="x")
        db.add(user)
        db.flush()
        return user
    return _make
