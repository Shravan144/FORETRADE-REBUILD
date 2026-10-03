import os
import tempfile

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["COOKIE_SECURE"] = "false"
os.environ["UPLOAD_DIR"] = os.path.join(tempfile.gettempdir(), "foretrade-api-tests")

import pytest
from app.db.base import Base
from app.db.session import engine
from app.models import audit_event, domain, exporter_profile, session, user, workspace  # noqa: F401


@pytest.fixture(autouse=True)
def fresh_database():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)
