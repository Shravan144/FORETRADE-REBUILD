from fastapi import APIRouter
from datetime import datetime, timezone
router=APIRouter(prefix="/api/v1/markets",tags=["markets"])
ITEM={"country_code":"US","hs_code":"6109","export_value_usd":1000000,"growth_pct":None,"source_name":"Curated public snapshot","source_period":"2025","dataset_version":"v1","refreshed_at":datetime.now(timezone.utc).isoformat()}
@router.get("")
def markets(hs_code:str|None=None): return {"items":[{**ITEM,"hs_code":hs_code or ITEM["hs_code"]}]}
@router.get("/{country_code}")
def market(country_code:str): return {**ITEM,"country_code":country_code.upper()}
