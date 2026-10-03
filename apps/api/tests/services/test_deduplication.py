from app.services.deduplication import find_duplicate_candidates
def test_same_normalized_company_is_duplicate():assert len(find_duplicate_candidates([{'company_name':'Acme Export Pvt. Ltd.'}],{'company_name':'ACME EXPORT PVT LTD'}))==1
