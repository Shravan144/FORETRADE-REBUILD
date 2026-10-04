"""
Automated Compliance & Certification Matrix
Knowledge base and resolver for mandatory destination customs certificates,
regulatory agencies, inspection bodies, and testing requirements by product HS category & country.
"""

from dataclasses import dataclass, asdict
from typing import Any, Dict, List, Optional


@dataclass
class CertificateRequirement:
    certificate_name: str
    issuing_authority_agency: str
    is_mandatory: bool
    purpose: str
    estimated_lead_time_days: int
    testing_or_audit_requirement: str
    penalties_or_consequences: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DestinationComplianceProfile:
    destination_country: str
    destination_country_name: str
    hs_code: str
    sector_name: str
    customs_entry_clearance_complexity: str  # "Standard", "Strict / Document-Heavy", "High Risk / Stringent"
    mandatory_certificates: List[CertificateRequirement]
    recommended_commercial_standards: List[CertificateRequirement]
    customs_declaration_documents: List[str]
    border_inspection_protocols: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "destination_country": self.destination_country,
            "destination_country_name": self.destination_country_name,
            "hs_code": self.hs_code,
            "sector_name": self.sector_name,
            "customs_entry_clearance_complexity": self.customs_entry_clearance_complexity,
            "mandatory_certificates": [c.to_dict() for c in self.mandatory_certificates],
            "recommended_commercial_standards": [c.to_dict() for c in self.recommended_commercial_standards],
            "customs_declaration_documents": self.customs_declaration_documents,
            "border_inspection_protocols": self.border_inspection_protocols,
        }


# Canonical Regulatory Matrices by Country & Sector
COMPLIANCE_MATRIX_DB: Dict[str, Dict[str, DestinationComplianceProfile]] = {
    # ── United States (US) ──
    "US": {
        # Apparel (6109)
        "6109": DestinationComplianceProfile(
            destination_country="US",
            destination_country_name="United States",
            hs_code="6109",
            sector_name="Textiles & Apparel",
            customs_entry_clearance_complexity="Strict / Document-Heavy",
            mandatory_certificates=[
                CertificateRequirement(
                    certificate_name="Consumer Product Safety Commission (CPSC) Flammability Certificate",
                    issuing_authority_agency="US Consumer Product Safety Commission (CPSC) & Accredited Lab",
                    is_mandatory=True,
                    purpose="Ensures knitwear garments meet 16 CFR Part 1610 standard for clothing flammability.",
                    estimated_lead_time_days=14,
                    testing_or_audit_requirement="Lab burn-rate testing of fabric samples prior to shipment.",
                    penalties_or_consequences="Cargo detention at port, immediate destruction order, or civil fines.",
                ),
                CertificateRequirement(
                    certificate_name="US Customs & Border Protection (CBP) UFLPA Supply Chain Traceability Audit",
                    issuing_authority_agency="US CBP / Third-Party DNA & Fiber Tracing Audit",
                    is_mandatory=True,
                    purpose="Uyghur Forced Labor Prevention Act (UFLPA) raw cotton origin documentation.",
                    estimated_lead_time_days=21,
                    testing_or_audit_requirement="Farm-to-fabric supply chain maps, raw cotton gin invoices, and isotopic testing.",
                    penalties_or_consequences="Withhold Release Order (WRO); total refusal of port entry.",
                ),
            ],
            recommended_commercial_standards=[
                CertificateRequirement(
                    certificate_name="OEKO-TEX Standard 100",
                    issuing_authority_agency="OEKO-TEX Association",
                    is_mandatory=False,
                    purpose="Verifies absence of harmful azo dyes, heavy metals, and formaldehyde.",
                    estimated_lead_time_days=30,
                    testing_or_audit_requirement="Annual chemical laboratory testing of garment swatches.",
                    penalties_or_consequences="Commercial buyer rejection during vendor onboarding.",
                ),
                CertificateRequirement(
                    certificate_name="GOTS (Global Organic Textile Standard)",
                    issuing_authority_agency="Control Union / GOTS Accredited Certifier",
                    is_mandatory=False,
                    purpose="Validates minimum 70-95% organic certified cotton cultivation.",
                    estimated_lead_time_days=45,
                    testing_or_audit_requirement="On-site gin and spinning mill environmental audits.",
                    penalties_or_consequences="Cannot label or market goods as organic in US retail.",
                ),
            ],
            customs_declaration_documents=[
                "Commercial Invoice with Detailed Fiber Composition Breakdown",
                "US CBP Form 7501 (Entry Summary)",
                "Packing List with Net/Gross weights per carton",
                "Textile Declaration of Origin",
                "Bill of Lading with Port of Entry (NY/NJ or Long Beach)",
            ],
            border_inspection_protocols="Random CBP fiber testing and isotopic testing for raw cotton origin verification.",
        ),

        # Pharmaceuticals (3004)
        "3004": DestinationComplianceProfile(
            destination_country="US",
            destination_country_name="United States",
            hs_code="3004",
            sector_name="Pharmaceuticals & Therapeutics",
            customs_entry_clearance_complexity="High Risk / Stringent",
            mandatory_certificates=[
                CertificateRequirement(
                    certificate_name="US FDA Drug Establishment Registration & NDC Listing",
                    issuing_authority_agency="US Food and Drug Administration (FDA)",
                    is_mandatory=True,
                    purpose="Official federal registration of overseas manufacturing facility and drug NDC code.",
                    estimated_lead_time_days=60,
                    testing_or_audit_requirement="Annual FDA electronic registration and facility inspection review.",
                    penalties_or_consequences="Immediate refusal of admission, import alert listing, and FDA seizure.",
                ),
                CertificateRequirement(
                    certificate_name="Current Good Manufacturing Practice (CGMP) 21 CFR Part 211 Certificate",
                    issuing_authority_agency="US FDA / State Licensing Authority",
                    is_mandatory=True,
                    purpose="Guarantees purity, potency, and safety controls during tablet formulation.",
                    estimated_lead_time_days=90,
                    testing_or_audit_requirement="Batch release Certificate of Analysis (CoA) and periodic FDA plant inspection.",
                    penalties_or_consequences="Federal injunction and immediate worldwide commercial product recall.",
                ),
            ],
            recommended_commercial_standards=[
                CertificateRequirement(
                    certificate_name="WHO-GMP (World Health Organization)",
                    issuing_authority_agency="CDSCO / State Drugs Controller",
                    is_mandatory=False,
                    purpose="Global pharmaceutical manufacturing baseline standard.",
                    estimated_lead_time_days=30,
                    testing_or_audit_requirement="Facility sanitation and cleanroom particulate validation.",
                    penalties_or_consequences="Lack of buyer confidence in overseas contract manufacturing.",
                ),
            ],
            customs_declaration_documents=[
                "FDA Prior Notice Confirmation Number (PNC)",
                "Certificate of Analysis (CoA) for each batch",
                "FDA Form 2877 (Radiation & Medical Controls if applicable)",
                "Active Pharmaceutical Ingredient (API) Drug Master File (DMF) reference",
            ],
            border_inspection_protocols="Automated FDA electronic screening via OASIS; mandatory physical sampling at port if flagged.",
        ),

        # Solar & Electronics (8541)
        "8541": DestinationComplianceProfile(
            destination_country="US",
            destination_country_name="United States",
            hs_code="8541",
            sector_name="Solar & Clean Energy",
            customs_entry_clearance_complexity="Strict / Document-Heavy",
            mandatory_certificates=[
                CertificateRequirement(
                    certificate_name="UL 1703 / UL 61730 Safety Certification",
                    issuing_authority_agency="Underwriters Laboratories (UL)",
                    is_mandatory=True,
                    purpose="Fire resistance, electrical shock safety, and mechanical loading durability.",
                    estimated_lead_time_days=60,
                    testing_or_audit_requirement="Physical laboratory stress testing of photovoltaic modules.",
                    penalties_or_consequences="Local building code rejection; commercial grid interconnection denial.",
                ),
                CertificateRequirement(
                    certificate_name="CBP Polysilicon Supply Chain Origin Audit",
                    issuing_authority_agency="US Customs and Border Protection (CBP)",
                    is_mandatory=True,
                    purpose="Verification that quartz, metallurgical silicon, and polysilicon are free from sanctioned regions.",
                    estimated_lead_time_days=30,
                    testing_or_audit_requirement="Bill of material tracing down to raw metallurgical silicon quarry.",
                    penalties_or_consequences="Container impoundment at Port of Long Beach under WRO regulations.",
                ),
            ],
            recommended_commercial_standards=[
                CertificateRequirement(
                    certificate_name="IEC 61215 Terrestrial Photovoltaic Reliability Certificate",
                    issuing_authority_agency="TUV Rheinland / IEC",
                    is_mandatory=False,
                    purpose="Long-term outdoor degradation and thermal cycling resistance.",
                    estimated_lead_time_days=45,
                    testing_or_audit_requirement="200 thermal cycles (-40C to +85C) and damp heat test.",
                    penalties_or_consequences="Commercial buyer warranty claims and institutional bankability exclusion.",
                ),
            ],
            customs_declaration_documents=[
                "Full Bill of Materials (BOM) with Polysilicon Origin Country",
                "Manufacturer Flash Test Data Sheet",
                "Certificate of Conformity (UL 1703)",
            ],
            border_inspection_protocols="Customs supply chain tracing audit and random cell luminescence quality verification.",
        ),

        # Automotive (8708)
        "8708": DestinationComplianceProfile(
            destination_country="US",
            destination_country_name="United States",
            hs_code="8708",
            sector_name="Automotive Components",
            customs_entry_clearance_complexity="Standard",
            mandatory_certificates=[
                CertificateRequirement(
                    certificate_name="DOT / NHTSA FMVSS Self-Certification",
                    issuing_authority_agency="US National Highway Traffic Safety Administration (NHTSA)",
                    is_mandatory=True,
                    purpose="Compliance with Federal Motor Vehicle Safety Standards (braking, steering, chassis).",
                    estimated_lead_time_days=20,
                    testing_or_audit_requirement="Component destructive burst and cycle endurance test records.",
                    penalties_or_consequences="Barred from OEM assembly plants; mandatory NHTSA safety defect recall.",
                ),
            ],
            recommended_commercial_standards=[
                CertificateRequirement(
                    certificate_name="IATF 16949 Automotive Quality Management",
                    issuing_authority_agency="International Automotive Task Force (IATF)",
                    is_mandatory=False,
                    purpose="Global automotive Tier-1 supplier quality qualification.",
                    estimated_lead_time_days=90,
                    testing_or_audit_requirement="Rigorous manufacturing line defect audit and PPAP Level 3 signoff.",
                    penalties_or_consequences="Disqualification from bidding on Ford, GM, or Tesla tier contracts.",
                ),
            ],
            customs_declaration_documents=[
                "DOT Compliance Declaration (Form HS-7)",
                "PPAP (Production Part Approval Process) Documentation Pack",
                "Commercial Invoice specifying OEM part numbers",
            ],
            border_inspection_protocols="Automated entry clearance with random metallurgical verification.",
        ),
    },

    # ── European Union / Germany (DE) ──
    "DE": {
        # Apparel (6109)
        "6109": DestinationComplianceProfile(
            destination_country="DE",
            destination_country_name="Germany (EU)",
            hs_code="6109",
            sector_name="Textiles & Apparel",
            customs_entry_clearance_complexity="Strict / Document-Heavy",
            mandatory_certificates=[
                CertificateRequirement(
                    certificate_name="EU REACH Regulation (EC No 1907/2006) Chemical Compliance",
                    issuing_authority_agency="European Chemicals Agency (ECHA) & Accredited Test Lab",
                    is_mandatory=True,
                    purpose="Prohibits hazardous substances including azo dyes, nickel release, and phthalates.",
                    estimated_lead_time_days=15,
                    testing_or_audit_requirement="Gas chromatography chemical laboratory testing of finished garments.",
                    penalties_or_consequences="Customs port seizure, RAPEX safety alert publication, total EU-wide ban.",
                ),
                CertificateRequirement(
                    certificate_name="EU Corporate Sustainability Due Diligence (CSDDD) Declaration",
                    issuing_authority_agency="German Federal Office for Economic Affairs and Export Control (BAFA)",
                    is_mandatory=True,
                    purpose="Supply chain verification for labor standards and fair wages (Lieferkettengesetz).",
                    estimated_lead_time_days=20,
                    testing_or_audit_requirement="Worker safety factory audit certificates and grievance mechanism proof.",
                    penalties_or_consequences="Heavy corporate fines up to 2% of annual turnover on German importers.",
                ),
            ],
            recommended_commercial_standards=[
                CertificateRequirement(
                    certificate_name="OEKO-TEX Standard 100",
                    issuing_authority_agency="Hohenstein Laboratories Germany",
                    is_mandatory=False,
                    purpose="Standard requirement across all major German retail brands.",
                    estimated_lead_time_days=25,
                    testing_or_audit_requirement="Comprehensive toxicological evaluation.",
                    penalties_or_consequences="German buyers will not sign procurement contracts without it.",
                ),
                CertificateRequirement(
                    certificate_name="BSCI (Business Social Compliance Initiative) Audit Grade A/B",
                    issuing_authority_agency="Amfori BSCI",
                    is_mandatory=False,
                    purpose="Social audit validating non-child labor, fair working hours, and workplace safety.",
                    estimated_lead_time_days=30,
                    testing_or_audit_requirement="Unannounced factory inspection and worker interview protocol.",
                    penalties_or_consequences="Immediate exclusion from European department store supply chains.",
                ),
            ],
            customs_declaration_documents=[
                "Single Administrative Document (SAD / ATLAS Customs Entry)",
                "REACH Declaration of Conformity",
                "Certificate of Origin (EUR.1 or Registered Exporter REX Statement)",
                "Detailed Packing List with EAN-13 barcodes",
            ],
            border_inspection_protocols="Random chemical sampling at Port of Hamburg and customs laboratory assay.",
        ),

        # Automotive (8708)
        "8708": DestinationComplianceProfile(
            destination_country="DE",
            destination_country_name="Germany (EU)",
            hs_code="8708",
            sector_name="Automotive Components",
            customs_entry_clearance_complexity="Strict / Document-Heavy",
            mandatory_certificates=[
                CertificateRequirement(
                    certificate_name="CE Marking & EU Machinery Directive 2006/42/EC Conformity",
                    issuing_authority_agency="EU Notified Body (TUV SUD / DEKRA)",
                    is_mandatory=True,
                    purpose="Harmonized European health, safety, and operational reliability standards.",
                    estimated_lead_time_days=45,
                    testing_or_audit_requirement="Technical construction file review and electromagnetic conformity.",
                    penalties_or_consequences="Immediate customs impoundment; criminal liability for non-compliant machinery.",
                ),
                CertificateRequirement(
                    certificate_name="EU End-of-Life Vehicles (ELV) Directive 2000/53/EC Declaration",
                    issuing_authority_agency="German Federal Environment Agency (UBA)",
                    is_mandatory=True,
                    purpose="Ensures components are free of lead, mercury, cadmium, and hexavalent chromium.",
                    estimated_lead_time_days=15,
                    testing_or_audit_requirement="Material composition IMDS (International Material Data System) entry.",
                    penalties_or_consequences="Rejection at German automotive OEM receiving docks.",
                ),
            ],
            recommended_commercial_standards=[
                CertificateRequirement(
                    certificate_name="VDA 6.1 / IATF 16949 German Automotive Standard",
                    issuing_authority_agency="Verband der Automobilindustrie (VDA)",
                    is_mandatory=False,
                    purpose="Mandatory benchmark for BMW, Mercedes-Benz, and Volkswagen Group tier suppliers.",
                    estimated_lead_time_days=90,
                    testing_or_audit_requirement="Annual on-site manufacturing process audit.",
                    penalties_or_consequences="Cannot secure contracts with German automotive conglomerates.",
                ),
            ],
            customs_declaration_documents=[
                "EU Declaration of Conformity (DoC)",
                "IMDS (International Material Data System) Submission ID",
                "ATLAS German Customs Clearance Declaration",
            ],
            border_inspection_protocols="Customs paperwork verification and random hazardous heavy metal testing.",
        ),

        # Chemicals (2902)
        "2902": DestinationComplianceProfile(
            destination_country="DE",
            destination_country_name="Germany (EU)",
            hs_code="2902",
            sector_name="Specialty Chemicals & Hydrocarbons",
            customs_entry_clearance_complexity="High Risk / Stringent",
            mandatory_certificates=[
                CertificateRequirement(
                    certificate_name="EU REACH Full Registration Dossier (ECHA)",
                    issuing_authority_agency="European Chemicals Agency (ECHA)",
                    is_mandatory=True,
                    purpose="Tox/ecotox data submission for any chemical substance imported above 1 tonne/year.",
                    estimated_lead_time_days=120,
                    testing_or_audit_requirement="Toxicological risk evaluation and Safety Data Sheet (SDS) generation.",
                    penalties_or_consequences="Complete prohibition of chemical sale in all 27 EU member states.",
                ),
                CertificateRequirement(
                    certificate_name="CLP Regulation (EC No 1272/2008) GHS Classification & Hazard Labeling",
                    issuing_authority_agency="German Federal Institute for Occupational Safety and Health (BAuA)",
                    is_mandatory=True,
                    purpose="Globally Harmonized System chemical pictograms, signal words, and hazard statements.",
                    estimated_lead_time_days=10,
                    testing_or_audit_requirement="Hazard evaluation according to European CLP criteria.",
                    penalties_or_consequences="Customs cargo confiscation for hazardous chemical transportation violation.",
                ),
            ],
            recommended_commercial_standards=[
                CertificateRequirement(
                    certificate_name="ISO 14001 Environmental Management",
                    issuing_authority_agency="Accredited ISO Registrar",
                    is_mandatory=False,
                    purpose="Verifies green manufacturing and minimal environmental release controls.",
                    estimated_lead_time_days=45,
                    testing_or_audit_requirement="Environmental waste lifecycle and emission audits.",
                    penalties_or_consequences="Lower ESG supplier score in European chemical tenders.",
                ),
            ],
            customs_declaration_documents=[
                "REACH Registration Number / Only Representative (OR) Appointment",
                "16-Section EU Safety Data Sheet (SDS) in German language",
                "Dangerous Goods Declaration (ADR/IMDG Code)",
            ],
            border_inspection_protocols="Mandatory hazardous goods inspection at Port of Hamburg chemicals terminal.",
        ),
    },

    # ── United Arab Emirates (AE) ──
    "AE": {
        # Food & Agri (1006)
        "1006": DestinationComplianceProfile(
            destination_country="AE",
            destination_country_name="United Arab Emirates",
            hs_code="1006",
            sector_name="Agriculture & Spices (Basmati Rice)",
            customs_entry_clearance_complexity="Standard",
            mandatory_certificates=[
                CertificateRequirement(
                    certificate_name="MOIAT Halal National Mark / Halal Certification",
                    issuing_authority_agency="Ministry of Industry & Advanced Technology (MOIAT) UAE",
                    is_mandatory=True,
                    purpose="Ensures food processing and packaging adheres to strict Islamic dietary standards.",
                    estimated_lead_time_days=20,
                    testing_or_audit_requirement="Accredited Islamic certification board facility audit and DNA testing.",
                    penalties_or_consequences="Cargo rejection at Port Jebel Ali; public blacklist.",
                ),
                CertificateRequirement(
                    certificate_name="Phytosanitary Health Certificate",
                    issuing_authority_agency="Ministry of Climate Change & Environment (MOCCAE) UAE / APEDA India",
                    is_mandatory=True,
                    purpose="Guarantees grain is free from pests, weevils, pesticide residues, and aflatoxins.",
                    estimated_lead_time_days=7,
                    testing_or_audit_requirement="Pre-shipment fumigation and maximum residue limit (MRL) lab assay.",
                    penalties_or_consequences="Mandatory re-export or destruction at exporter's expense.",
                ),
            ],
            recommended_commercial_standards=[
                CertificateRequirement(
                    certificate_name="ISO 22000 / HACCP Food Safety Management",
                    issuing_authority_agency="Accredited Certification Body",
                    is_mandatory=False,
                    purpose="Ensures hazard analysis critical control points during milling and packaging.",
                    estimated_lead_time_days=30,
                    testing_or_audit_requirement="Milling plant hygienic barrier inspection.",
                    penalties_or_consequences="Rejection by premium UAE hypermarkets (Lulu, Carrefour).",
                ),
            ],
            customs_declaration_documents=[
                "Dubai Municipality Food Import Clearance Form (FIRS Portal)",
                "Original Halal Certificate attested by UAE Embassy",
                "Original Phytosanitary Certificate",
                "Certificate of Origin under India-UAE CEPA (for 0% duty entry)",
            ],
            border_inspection_protocols="Dubai Municipality Food Safety Clinic physical grain sampling at Jebel Ali Port.",
        ),

        # Apparel (6109)
        "6109": DestinationComplianceProfile(
            destination_country="AE",
            destination_country_name="United Arab Emirates",
            hs_code="6109",
            sector_name="Textiles & Apparel",
            customs_entry_clearance_complexity="Standard",
            mandatory_certificates=[
                CertificateRequirement(
                    certificate_name="ECAS / EQM Certificate of Conformity for Textiles",
                    issuing_authority_agency="Emirates Conformity Assessment Scheme (MOIAT UAE)",
                    is_mandatory=True,
                    purpose="Verifies compliance with UAE Technical Regulations for fiber composition and care labels in Arabic.",
                    estimated_lead_time_days=12,
                    testing_or_audit_requirement="Care label bilingual audit (Arabic/English) and azo-dye lab test.",
                    penalties_or_consequences="Goods held at customs until re-labeled at high port demurrage costs.",
                ),
                CertificateRequirement(
                    certificate_name="India-UAE CEPA Preferential Certificate of Origin",
                    issuing_authority_agency="Directorate General of Foreign Trade (DGFT) India",
                    is_mandatory=True,
                    purpose="Grants 0% duty-free entry into UAE market under CEPA bilateral treaty.",
                    estimated_lead_time_days=3,
                    testing_or_audit_requirement="Cost accountant verification of minimum 40% value addition in India.",
                    penalties_or_consequences="Loss of 5% duty concession; goods taxed at full standard tariff.",
                ),
            ],
            recommended_commercial_standards=[
                CertificateRequirement(
                    certificate_name="ISO 9001 Quality Management System",
                    issuing_authority_agency="ISO Accredited Registrar",
                    is_mandatory=False,
                    purpose="Baseline commercial quality reliability indicator.",
                    estimated_lead_time_days=25,
                    testing_or_audit_requirement="Documented quality assurance workflows.",
                    penalties_or_consequences="Lower ranking during Dubai corporate procurement vendor shortlists.",
                ),
            ],
            customs_declaration_documents=[
                "Dubai Customs Mirsal 2 Import Declaration",
                "MOIAT ECAS Registration Certificate",
                "CEPA Preferential Certificate of Origin (digitally signed)",
                "Commercial Invoice & Detailed Packing List",
            ],
            border_inspection_protocols="Automated green channel clearance via Dubai Customs Mirsal II; random Arabic label check.",
        ),
    },

    # ── Australia (AU) ──
    "AU": {
        # Pharmaceuticals (3004)
        "3004": DestinationComplianceProfile(
            destination_country="AU",
            destination_country_name="Australia",
            hs_code="3004",
            sector_name="Pharmaceuticals & Therapeutics",
            customs_entry_clearance_complexity="High Risk / Stringent",
            mandatory_certificates=[
                CertificateRequirement(
                    certificate_name="Therapeutic Goods Administration (TGA) GMP Clearance",
                    issuing_authority_agency="Australian Department of Health & TGA",
                    is_mandatory=True,
                    purpose="Mandatory overseas manufacturer clearance before therapeutic goods can be imported.",
                    estimated_lead_time_days=90,
                    testing_or_audit_requirement="TGA desktop audit or on-site manufacturing inspection.",
                    penalties_or_consequences="Prohibited import; Australian Border Force seizure and criminal prosecution.",
                ),
                CertificateRequirement(
                    certificate_name="Australian Register of Therapeutic Goods (ARTG) Entry",
                    issuing_authority_agency="Australian Therapeutic Goods Administration (TGA)",
                    is_mandatory=True,
                    purpose="Product registration on the official ARTG register with designated Australian Sponsor.",
                    estimated_lead_time_days=60,
                    testing_or_audit_requirement="Full clinical efficacy and pharmaceutical chemistry dossier submission.",
                    penalties_or_consequences="Unlawful supply under Therapeutic Goods Act 1989.",
                ),
            ],
            recommended_commercial_standards=[
                CertificateRequirement(
                    certificate_name="PIC/S (Pharmaceutical Inspection Co-operation Scheme) GMP",
                    issuing_authority_agency="PIC/S Participating Authority",
                    is_mandatory=False,
                    purpose="Speeds up Australian TGA desktop clearance through mutual recognition.",
                    estimated_lead_time_days=30,
                    testing_or_audit_requirement="Harmonized international PIC/S GMP plant inspection.",
                    penalties_or_consequences="Longer audit delay by Australian health authorities.",
                ),
            ],
            customs_declaration_documents=[
                "TGA Import Permit & ARTG Certificate",
                "Australian Customs Integrated Cargo System (ICS) Entry",
                "Batch Release Certificate of Analysis",
            ],
            border_inspection_protocols="Mandatory referral to Australian Border Force and TGA customs officer inspection.",
        ),

        # Apparel (6109)
        "6109": DestinationComplianceProfile(
            destination_country="AU",
            destination_country_name="Australia",
            hs_code="6109",
            sector_name="Textiles & Apparel",
            customs_entry_clearance_complexity="Standard",
            mandatory_certificates=[
                CertificateRequirement(
                    certificate_name="Australian Biosecurity Import Conditions (BICON) Clearance",
                    issuing_authority_agency="Department of Agriculture, Fisheries and Forestry (DAFF)",
                    is_mandatory=True,
                    purpose="Ensures textile cargo, cardboard cartons, and wooden pallets are free from biological contamination.",
                    estimated_lead_time_days=5,
                    testing_or_audit_requirement="ISPM 15 heat treatment for wooden packaging; cargo insect inspection.",
                    penalties_or_consequences="Immediate fumigation at destination port ($1,500+ cost) or re-export.",
                ),
                CertificateRequirement(
                    certificate_name="India-Australia ECTA Preferential Certificate of Origin",
                    issuing_authority_agency="Designated Issuing Agency (FIEO / Export Inspection Council)",
                    is_mandatory=True,
                    purpose="Grants 0% duty-free tariff access under the ECTA trade pact.",
                    estimated_lead_time_days=4,
                    testing_or_audit_requirement="Proof of meeting 35% Qualifying Value Content (QVC).",
                    penalties_or_consequences="Forfeiture of 5% duty-free benefit.",
                ),
            ],
            recommended_commercial_standards=[
                CertificateRequirement(
                    certificate_name="OEKO-TEX Standard 100",
                    issuing_authority_agency="OEKO-TEX",
                    is_mandatory=False,
                    purpose="Commercial buyer preference across retail chains (Cotton On, Kmart Australia).",
                    estimated_lead_time_days=25,
                    testing_or_audit_requirement="Certified non-toxic chemical testing.",
                    penalties_or_consequences="Commercial supplier disqualification.",
                ),
            ],
            customs_declaration_documents=[
                "Australian Border Force Import Declaration (N10)",
                "ECTA Certificate of Origin",
                "BICON Packing Declaration",
            ],
            border_inspection_protocols="Strict biosecurity and timber packaging inspection at Port Botany / Melbourne.",
        ),
    },
}


def resolve_compliance_requirements(
    destination_country: str,
    hs_code: str,
) -> DestinationComplianceProfile:
    """
    Automated Compliance & Certification Matrix Resolver
    Maps (Destination Country, HS Code) -> Mandatory & Recommended Customs Certificates.
    Falls back to intelligent sector defaults if exact country-HS pair is not in matrix.
    """
    country = destination_country.upper()
    prefix = hs_code[:4]

    # Check exact match in database
    if country in COMPLIANCE_MATRIX_DB and prefix in COMPLIANCE_MATRIX_DB[country]:
        return COMPLIANCE_MATRIX_DB[country][prefix]

    # Fallback to general destination standards
    country_name_map = {
        "US": "United States", "DE": "Germany", "GB": "United Kingdom",
        "AE": "United Arab Emirates", "AU": "Australia", "JP": "Japan",
        "FR": "France", "NL": "Netherlands", "CA": "Canada", "EG": "Egypt", "KE": "Kenya",
    }
    dest_name = country_name_map.get(country, country)

    # General fallback profile
    return DestinationComplianceProfile(
        destination_country=country,
        destination_country_name=dest_name,
        hs_code=prefix,
        sector_name="General International Trade Goods",
        customs_entry_clearance_complexity="Standard",
        mandatory_certificates=[
            CertificateRequirement(
                certificate_name=f"{dest_name} National Customs Declaration & Standard Conformity",
                issuing_authority_agency=f"{dest_name} Ministry of Trade & Customs Directorate",
                is_mandatory=True,
                purpose="Baseline national import clearance and tariff classification conformity.",
                estimated_lead_time_days=10,
                testing_or_audit_requirement="Official commercial invoice and packing list review.",
                penalties_or_consequences="Goods clearance delays and port storage penalties.",
            ),
            CertificateRequirement(
                certificate_name="Universal Certificate of Origin (Non-Preferential / Chamber of Commerce)",
                issuing_authority_agency="Local Chamber of Commerce & Industry",
                is_mandatory=True,
                purpose="Authenticates manufacturing origin of goods for trade statistical tracking.",
                estimated_lead_time_days=3,
                testing_or_audit_requirement="Verification of manufacturing origin and invoice authenticity.",
                penalties_or_consequences="Customs document discrepancy queries.",
            ),
        ],
        recommended_commercial_standards=[
            CertificateRequirement(
                certificate_name="ISO 9001:2015 Quality Management System",
                issuing_authority_agency="Accredited ISO Registrar",
                is_mandatory=False,
                purpose="Demonstrates standardized manufacturing procedures and client assurance.",
                estimated_lead_time_days=30,
                testing_or_audit_requirement="Annual quality manual audit.",
                penalties_or_consequences="Lower enterprise procurement evaluation scores.",
            ),
        ],
        customs_declaration_documents=[
            "Commercial Invoice with full HS code description",
            "Packing List with container numbers and gross/net weights",
            "Bill of Lading / Airway Bill",
            "Certificate of Origin",
        ],
        border_inspection_protocols=f"Standard customs entry inspection protocol for {dest_name}.",
    )
