from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.analytics import exports_router, router as analytics_router
from app.api.v1.companies import router as companies_router
from app.api.v1.auth import router as auth_router
from app.api.v1.copilot import router as copilot_router
from app.api.v1.documents import router as documents_router
from app.api.v1.exporter_profiles import router as exporter_profiles_router
from app.api.v1.imports import router as imports_router
from app.api.v1.leads import router as leads_router
from app.api.v1.market_watchlists import router as watchlist_router
from app.api.v1.markets import router as markets_router
from app.api.v1.matchmaking import router as matchmaking_router
from app.api.v1.system import router as system_router
from app.api.v1.trade_intelligence import router as trade_intelligence_router
from app.api.v1.workspaces import router as workspaces_router
from app.core.config import settings
from app.core.request_id import RequestIdMiddleware
from app.db.base import Base
from app.db.session import engine

# Import all models so Base has all metadata registered
import app.models.audit_event  # noqa: F401
import app.models.domain  # noqa: F401
import app.models.exporter_profile  # noqa: F401
import app.models.session  # noqa: F401
import app.models.trade_intelligence  # noqa: F401
import app.models.user  # noqa: F401
import app.models.workspace  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure all tables exist on startup automatically
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        # Tables may have already been created concurrently by another worker
        pass
    try:
        from sqlalchemy import inspect, text
        with engine.connect() as conn:
            insp = inspect(engine)
            existing_tables = insp.get_table_names()
            for table_name, table in Base.metadata.tables.items():
                if table_name in existing_tables:
                    existing_cols = {c["name"] for c in insp.get_columns(table_name)}
                    for col in table.columns:
                        if col.name not in existing_cols:
                            col_type = col.type.compile(engine.dialect)
                            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS {col.name} {col_type}"))
            conn.commit()
    except Exception as e:
        print(f"Lifespan schema column sync: {e}")
    yield


app = FastAPI(title="ForeTrade API", version="0.1.0", lifespan=lifespan)
app.add_middleware(RequestIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.allowed_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-CSRF-Token", "X-Request-ID"],
)

for router in (
    analytics_router,
    exports_router,
    system_router,
    auth_router,
    workspaces_router,
    exporter_profiles_router,
    markets_router,
    watchlist_router,
    imports_router,
    companies_router,
    leads_router,
    trade_intelligence_router,
    matchmaking_router,
    copilot_router,
    documents_router,
):
    app.include_router(router)


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": "api"}
