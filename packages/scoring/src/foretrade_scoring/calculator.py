from dataclasses import dataclass
@dataclass
class OpportunityEvaluation: eligible:bool; confidence:str; missing_inputs:list[str]; ineligibility_reasons:list[str]
def evaluate_opportunity(profile:dict,company:dict,market=None,preset=None):
 if not set(profile.get('products',[]))&set(company.get('products',[])):return OpportunityEvaluation(False,'low',[],['product_mismatch'])
 missing=[] if profile.get('capacity') is not None else ['exporter_capacity'];return OpportunityEvaluation(True,'low' if missing else 'high',missing,[])
