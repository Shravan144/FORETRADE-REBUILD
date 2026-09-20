def normalized_name(value:str)->str:return ''.join(c for c in value.lower() if c.isalnum())
def find_duplicate_candidates(companies:list[dict],canonical:dict)->list[dict]:return [c for c in companies if normalized_name(c.get('company_name',''))==normalized_name(canonical.get('company_name',''))]
