from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).parents[1]/"src"))
from foretrade_trade_data.models import TradeMarketMetric,calculate_market_score
def test_market_score_marks_missing_growth_as_low_confidence():
 s=calculate_market_score(TradeMarketMetric("US",1,None,2));assert s.confidence=="low";assert "growth_pct" in s.missing_inputs
