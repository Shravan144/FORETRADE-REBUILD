from fastapi import FastAPI
from app.api.v1.auth import router as auth_router
from app.api.v1.exporter_profiles import router as exporter_profiles_router
from app.api.v1.markets import router as markets_router
from app.api.v1.system import router as system_router
from app.core.request_id import RequestIdMiddleware
app=FastAPI(title="ForeTrade API",version="0.1.0");app.add_middleware(RequestIdMiddleware);app.include_router(system_router);app.include_router(auth_router);app.include_router(exporter_profiles_router);app.include_router(markets_router)
@app.get("/healthz")
def healthz()->dict[str,str]:return {"status":"ok","service":"api"}
