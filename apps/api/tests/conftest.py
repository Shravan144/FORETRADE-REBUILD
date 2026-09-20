import os
import pytest
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine


@pytest.fixture(scope="session")
def postgres_engine() -> Engine:
    url = os.getenv("TEST_DATABASE_URL", "postgresql+psycopg://foretrade:foretrade-local-only@localhost:5433/foretrade")
    engine = create_engine(url)
    try:
        yield engine
    finally:
        engine.dispose()

