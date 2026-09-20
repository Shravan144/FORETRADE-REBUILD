from fastapi import APIRouter

router = APIRouter(prefix="/api/v1/system", tags=["system"])


@router.get("/status")
def status() -> dict[str, str]:
    return {"status": "ok", "service": "api"}
