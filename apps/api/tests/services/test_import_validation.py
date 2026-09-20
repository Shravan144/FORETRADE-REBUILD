from app.services.import_validation import validate_row
def test_preview_reports_blank_required_fields_and_formula_cells():
 r=validate_row(4,{"Company":"","Country":"India","Product":"=NOW()"},{"Company":"company_name","Country":"country","Product":"product_or_industry"});assert {i.code for i in r.issues}=={"required_company_name","formula_cell_not_allowed"}
