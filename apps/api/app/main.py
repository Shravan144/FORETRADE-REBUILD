from fastapi import FastAPI
from app.api.v1.auth import router as auth_router
from app.api.v1.exporter_profiles import router as exporter_profiles_router
from app.api.v1.imports import router as imports_router
from app.api.v1.market_watchlists import router as watchlist_router
from app.api.v1.markets import router as markets_router
from app.api.v1.system import router as system_router
from app.core.request_id import RequestIdMiddleware
app=FastAPI(title='ForeTrade API',version='0.1.0');app.add_middleware(RequestIdMiddleware)
for router in (system_router,auth_router,exporter_profiles_router,markets_router,watchlist_router,imports_router):app.include_router(router)
@app.get('/healthz')
def healthz()->dict[str,str]:return {'status':'ok','service':'api'}
