"""Shared pytest fixtures for ThreatAtlas backend tests.

Requires a PostgreSQL test database. Set TEST_DATABASE_URL to override the
default (postgresql://threatatlas:threatatlas_dev@localhost:5432/threatatlas_test).

The session-scoped engine creates all tables once; each test runs inside a
transaction that is rolled back on teardown so tests are fully isolated.
"""

import os
from datetime import timedelta
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from app.auth.jwt import create_access_token
from app.auth.password import get_password_hash
from app.database import Base, get_db
from app.main import app
from app.models import User
from app.models.enums import UserRole

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql://threatatlas:threatatlas_dev@localhost:5432/threatatlas_test",
)

# ── Create the test DB if it doesn't exist ────────────────────────────────────

def _ensure_test_db_exists(url: str) -> None:
    """Connect to the 'threatatlas' DB and CREATE the test DB if needed."""
    from urllib.parse import urlparse, urlunparse
    parsed = urlparse(url)
    db_name = parsed.path.lstrip("/")
    admin_url = urlunparse(parsed._replace(path="/threatatlas"))
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        with admin_engine.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": db_name}
            ).scalar()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{db_name}"'))
    finally:
        admin_engine.dispose()


# ── Engine (session-scoped — created once per test run) ────────────────────────

@pytest.fixture(scope="session")
def engine():
    _ensure_test_db_exists(TEST_DATABASE_URL)
    eng = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)

    # PostgreSQL ENUM types are not created by SQLAlchemy when create_type=False.
    # Use DO blocks (idempotent) so this is safe on a fresh or pre-existing test DB.
    enum_ddl = [
        """
        DO $$ BEGIN
            CREATE TYPE userrole AS ENUM ('admin', 'standard', 'read_only');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
        """,
        """
        DO $$ BEGIN
            CREATE TYPE productstatus AS ENUM ('design', 'development', 'testing', 'deployment', 'production');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
        """,
        """
        DO $$ BEGIN
            CREATE TYPE collaboratorrole AS ENUM ('owner', 'editor', 'viewer');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$
        """,
    ]
    with eng.connect() as conn:
        for ddl in enum_ddl:
            conn.execute(text(ddl))
        conn.commit()

    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)


# ── Per-test transactional isolation ──────────────────────────────────────────

@pytest.fixture()
def db(engine) -> Session:
    """Each test gets its own transaction, rolled back on teardown."""
    connection = engine.connect()
    transaction = connection.begin()
    TestSession = sessionmaker(bind=connection)
    session = TestSession()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


# ── TestClient with get_db override and mocked lifespan seed ──────────────────

@pytest.fixture()
def client(db) -> TestClient:
    """FastAPI TestClient wired to the test DB session."""
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    # The app lifespan calls seed_knowledge_base() which opens its own
    # SessionLocal against the real DB — mock it out in tests.
    with patch("app.seed.seed_knowledge_base"):
        with TestClient(app, raise_server_exceptions=True) as c:
            yield c

    app.dependency_overrides.clear()


# ── User factory helpers ───────────────────────────────────────────────────────

def _create_user(
    db: Session,
    email: str,
    password: str = "testpass123",
    role: str = UserRole.STANDARD.value,
    full_name: str | None = None,
) -> User:
    user = User(
        email=email,
        username=email.split("@")[0],
        hashed_password=get_password_hash(password),
        full_name=full_name or email.split("@")[0],
        is_active=True,
        role=role,
    )
    db.add(user)
    db.flush()  # populate user.id without committing
    return user


@pytest.fixture()
def admin_user(db: Session) -> User:
    return _create_user(db, "admin@test.com", role=UserRole.ADMIN.value)


@pytest.fixture()
def standard_user(db: Session) -> User:
    return _create_user(db, "user@test.com", role=UserRole.STANDARD.value)


@pytest.fixture()
def other_user(db: Session) -> User:
    return _create_user(db, "other@test.com", role=UserRole.STANDARD.value)


# ── JWT header helpers ─────────────────────────────────────────────────────────

def make_auth_headers(user: User) -> dict:
    token = create_access_token({"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}


def make_expired_token(user: User) -> str:
    return create_access_token({"sub": str(user.id)}, expires_delta=timedelta(seconds=-1))


@pytest.fixture()
def admin_headers(admin_user: User) -> dict:
    return make_auth_headers(admin_user)


@pytest.fixture()
def user_headers(standard_user: User) -> dict:
    return make_auth_headers(standard_user)


@pytest.fixture()
def other_headers(other_user: User) -> dict:
    return make_auth_headers(other_user)
