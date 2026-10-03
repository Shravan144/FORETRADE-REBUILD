import sys;from pathlib import Path
sys.path.insert(0,str(Path(__file__).parents[1]/'src'))
from foretrade_scoring.calculator import evaluate_opportunity
def test_unrelated_product_is_ineligible():assert evaluate_opportunity({'products':['textile']},{'products':['chemical']}).ineligibility_reasons==['product_mismatch']
def test_missing_capacity_lowers_confidence_without_favourable_default():
 r=evaluate_opportunity({'products':['textile']},{'products':['textile']});assert r.confidence=='low';assert 'exporter_capacity'in r.missing_inputs
