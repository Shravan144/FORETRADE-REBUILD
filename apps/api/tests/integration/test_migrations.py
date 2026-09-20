from sqlalchemy import inspect


def test_database_has_audit_events_table(postgres_engine):
    assert "audit_events" in inspect(postgres_engine).get_table_names()
