from dataclasses import dataclass
@dataclass
class TradeMarketMetric: country_code:str; export_value_usd:float|None; growth_pct:float|None; diversification_score:float|None
@dataclass
class MarketScore: value:float; confidence:str; missing_inputs:list[str]
def calculate_market_score(metric:TradeMarketMetric,preferences=None)->MarketScore:
 vals={"export_value_usd":metric.export_value_usd,"growth_pct":metric.growth_pct,"diversification_score":metric.diversification_score};missing=[k for k,v in vals.items() if v is None];available=[v for v in vals.values() if v is not None];return MarketScore(round(sum(available)/len(available),1) if available else 0,"low" if missing else "high",missing)
