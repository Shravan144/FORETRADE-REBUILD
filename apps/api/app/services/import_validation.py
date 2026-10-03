from dataclasses import dataclass
@dataclass
class Issue: code:str
@dataclass
class ValidationResult: row_number:int; canonical:dict; issues:list[Issue]
def validate_row(row_number:int,raw:dict,mapping:dict)->ValidationResult:
 canonical={target:raw.get(source) for source,target in mapping.items()};issues=[]
 if not canonical.get("company_name"):issues.append(Issue("required_company_name"))
 if any(isinstance(value,str) and value.startswith("=") for value in raw.values()):issues.append(Issue("formula_cell_not_allowed"))
 return ValidationResult(row_number,canonical,issues)
