from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.analytics import exports_router, router as analytics_router
from app.api.v1.companies import router as companies_router
from app.api.v1.auth import router as auth_router
from app.api.v1.exporter_profiles import router as exporter_profiles_router
from app.api.v1.imports import router as imports_router
from app.api.v1.leads import router as leads_router
from app.api.v1.market_watchlists import router as watchlist_router
from app.api.v1.markets import router as markets_router
from app.api.v1.system import router as system_router
from app.api.v1.workspaces import router as workspaces_router
from app.core.config import settings
from app.core.request_id import RequestIdMiddleware
app=FastAPI(title='ForeTrade API',version='0.1.0')
app.add_middleware(RequestIdMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=list(settings.allowed_origins), allow_credentials=True, allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["Content-Type", "X-CSRF-Token", "X-Request-ID"])
for router in (analytics_router,exports_router,system_router,auth_router,workspaces_router,exporter_profiles_router,markets_router,watchlist_router,imports_router,companies_router,leads_router):app.include_router(router)
@app.get('/healthz')
def healthz()->dict[str,str]:return {'status':'ok','service':'api'}
