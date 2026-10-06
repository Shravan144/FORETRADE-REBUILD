"""Export Documentation Suite Service for ForeTrade.
Generates, calculates, auto-populates, and renders Proforma Invoices (P/I)
and Commercial Packing Lists (CPL) according to international EXIM standards.
"""

from datetime import datetime, timedelta
import io
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.domain import CommercialDocument, Company, CompanySourceRecord, Lead
from app.models.trade_intelligence import GlobalBuyerCatalog
from app.services.workspace_service import get_latest_profile_version

# Port inference table for common trading partners
PORT_MAP = {
    "AE": "Port of Jebel Ali, Dubai, UAE",
    "US": "Port of Los Angeles / Long Beach, CA, USA",
    "NL": "Port of Rotterdam, Netherlands",
    "DE": "Port of Hamburg, Germany",
    "GB": "Port of Felixstowe / Southampton, UK",
    "SG": "Port of Singapore, Singapore",
    "SA": "King Abdulaziz Port, Dammam / Jeddah, Saudi Arabia",
    "VN": "Port of Hai Phong / Cat Lai, Vietnam",
    "JP": "Port of Yokohama / Tokyo, Japan",
    "AU": "Port of Melbourne / Sydney, Australia",
    "IT": "Port of Genoa, Italy",
    "FR": "Port of Le Havre, France",
    "IN": "Nhava Sheva (JNPT) / Mundra Port, India",
}

# Currency mapping
CURRENCY_MAP = {
    "AE": "USD",  # commonly USD or AED in wholesale trade
    "US": "USD",
    "NL": "EUR",
    "DE": "EUR",
    "FR": "EUR",
    "IT": "EUR",
    "GB": "GBP",
    "JP": "USD",
    "SG": "USD",
    "IN": "INR",
}


def _generate_doc_number(db: Session, workspace_id: str, doc_type: str) -> str:
    """Generates sequence numbers like PI-2026-0001 or PKL-2026-0001."""
    prefix = "PI" if doc_type == "proforma_invoice" else "PKL"
    current_year = datetime.now().year

    count = (
        db.scalar(
            select(func.count(CommercialDocument.id)).where(
                CommercialDocument.workspace_id == workspace_id,
                CommercialDocument.document_type == doc_type,
            )
        )
        or 0
    )
    return f"{prefix}-{current_year}-{count + 1:04d}"


def calculate_container_teu(gross_weight_kg: float, total_cbm: float) -> dict[str, Any]:
    """Calculates TEU (Twenty-foot Equivalent Unit) container requirements.
    Standard 20' FCL holds ~22,000 kg / 28-30 CBM.
    Standard 40' HC holds ~26,500 kg / 68-70 CBM.
    """
    tons = gross_weight_kg / 1000.0

    if tons <= 22 and total_cbm <= 28:
        return {
            "container_type": "1 x 20' FCL (Standard Container)",
            "container_count": 1,
            "teu_equivalent": 1.0,
            "max_payload_kg": 22000,
            "utilization_pct": min(100.0, round((gross_weight_kg / 22000) * 100, 1)),
        }
    elif tons <= 26.5 and total_cbm <= 68:
        return {
            "container_type": "1 x 40' HC (High Cube Container)",
            "container_count": 1,
            "teu_equivalent": 2.0,
            "max_payload_kg": 26500,
            "utilization_pct": min(100.0, round((gross_weight_kg / 26500) * 100, 1)),
        }
    else:
        # Multiple containers
        num_40ft = int(tons // 25)
        rem_tons = tons % 25
        num_20ft = 1 if rem_tons > 0 else 0
        container_desc = f"{num_40ft} x 40' HC" if num_40ft > 0 else ""
        if num_20ft > 0:
            container_desc = f"{container_desc} + {num_20ft} x 20' FCL" if container_desc else f"{num_20ft} x 20' FCL"
        teu = (num_40ft * 2.0) + (num_20ft * 1.0)
        return {
            "container_type": container_desc,
            "container_count": num_40ft + num_20ft,
            "teu_equivalent": teu,
            "max_payload_kg": (num_40ft * 26500) + (num_20ft * 22000),
            "utilization_pct": 95.0,
        }


def auto_populate_document_data(
    db: Session,
    workspace_id: str,
    lead_id: str,
    doc_type: str = "proforma_invoice",
) -> dict[str, Any]:
    """Extracts lead, company, profile, and intelligence data to formulate
    a complete ready-to-issue Proforma Invoice or Commercial Packing List.
    """
    lead = db.scalar(select(Lead).where(Lead.id == lead_id, Lead.workspace_id == workspace_id))
    if not lead:
        raise ValueError("Lead not found in this workspace")

    company = db.scalar(select(Company).where(Company.id == lead.company_id, Company.workspace_id == workspace_id))
    if not company:
        raise ValueError("Company associated with lead not found")

    # Exporter Profile
    profile_record = get_latest_profile_version(db, workspace_id)
    profile_payload = profile_record.payload if profile_record else {}

    # Buyer Catalog Lookup if available
    buyer_catalog = None
    source_record = db.scalar(
        select(CompanySourceRecord).where(
            CompanySourceRecord.company_id == company.id,
            CompanySourceRecord.source_type == "global_buyer_catalog",
        )
    )
    if source_record and source_record.raw_data and source_record.raw_data.get("buyer_catalog_id"):
        catalog_id = source_record.raw_data.get("buyer_catalog_id")
        buyer_catalog = db.scalar(select(GlobalBuyerCatalog).where(GlobalBuyerCatalog.id == catalog_id))

    if not buyer_catalog and company.normalized_name and company.country_code:
        buyer_catalog = db.scalar(
            select(GlobalBuyerCatalog).where(
                GlobalBuyerCatalog.normalized_name == company.normalized_name,
                GlobalBuyerCatalog.country_code == company.country_code,
            )
        )

    attrs = company.attributes or {}
    dest_country = (buyer_catalog.country_code if buyer_catalog else None) or company.country_code or "AE"
    dest_port = PORT_MAP.get(dest_country.upper(), f"Port of Discharge, {dest_country}")

    # Exporter Details
    exporter_name = profile_payload.get("company_name", "ForeTrade Global Exports Ltd.")
    exporter_details = {
        "company_name": exporter_name,
        "address": profile_payload.get("company_address") or profile_payload.get("address", "Plot No. 42, Export Promotion Industrial Park, MIDC, Navi Mumbai 400705, Maharashtra, India"),
        "country": profile_payload.get("origin_country", "India"),
        "tax_id": profile_payload.get("tax_id", "GSTIN: 27AABCF1234F1Z5"),
        "iec_code": profile_payload.get("iec_code", "IEC: 0311029481"),
        "contact_person": profile_payload.get("contact_person", "Rajesh Sharma (VP Exports)"),
        "email": profile_payload.get("contact_email") or profile_payload.get("email", "exports@foretrade-global.com"),
        "phone": profile_payload.get("contact_phone") or profile_payload.get("phone", "+91 22 2781 9900"),
    }

    # Bank Details
    bank_details = {
        "beneficiary_name": exporter_name,
        "bank_name": profile_payload.get("bank_name", "State Bank of India (Overseas Banking Branch)"),
        "branch": profile_payload.get("bank_branch", "Commercial Branch, Fort, Mumbai - 400001"),
        "account_number": profile_payload.get("bank_account", "309812458923"),
        "swift_code": profile_payload.get("bank_swift", "SBININBB001"),
        "iban": profile_payload.get("bank_iban", "IN30SBIN0000309812458923"),
        "ifsc_code": profile_payload.get("bank_ifsc", "SBIN0000300"),
    }

    # Buyer Details
    buyer_name = (buyer_catalog.company_name if buyer_catalog else None) or company.name
    buyer_city = (buyer_catalog.city if buyer_catalog else None) or attrs.get("city", "Free Port Zone")
    buyer_contact = (buyer_catalog.contact_name if buyer_catalog else None) or company.contact_name or "Procurement Director"
    buyer_email = company.contact_email or f"procurement@{company.normalized_name.replace(' ', '').lower()[:12]}.com"
    buyer_phone = company.contact_phone or "+971 4 295 8800"

    buyer_details = {
        "company_name": buyer_name,
        "billing_address": f"{buyer_city} Commercial District, Suite 400, {dest_country}",
        "shipping_address": f"{buyer_city} Logistics Hub, Berth 12, {dest_port}",
        "country_code": dest_country,
        "contact_name": buyer_contact,
        "email": buyer_email,
        "phone": buyer_phone,
    }

    # Incoterm & Currency
    incoterm = attrs.get("preferred_incoterms") or (buyer_catalog.preferred_incoterms if buyer_catalog else None) or "CIF"
    currency = CURRENCY_MAP.get(dest_country.upper(), "USD")

    # Goods & Line items calculation
    hs_code = "7210.49"  # Default high-demand steel / industrial standard
    if attrs.get("hs_codes") and len(attrs.get("hs_codes")) > 0:
        hs_code = attrs["hs_codes"][0]
    elif buyer_catalog and buyer_catalog.hs_codes and len(buyer_catalog.hs_codes) > 0:
        hs_code = buyer_catalog.hs_codes[0]

    product_desc = company.product_or_industry or "Cold-Rolled Galvanized Industrial Steel Coils (Grade EN 10346)"
    avg_tons = float(attrs.get("avg_order_tons") or (buyer_catalog.avg_order_tons if buyer_catalog else None) or 25.0)

    # Unit price estimation: standard commercial tier
    unit_price = 1180.00
    quantity = avg_tons
    total_amount = round(quantity * unit_price, 2)

    # Logistics metrics
    package_count = int(avg_tons * 2)  # e.g., 50 heavy coils / crates
    package_type = "Steel-Banded Export Wooden Skids"
    net_weight_kg = round(avg_tons * 1000.0, 2)
    gross_weight_kg = round(avg_tons * 1045.0, 2)  # tare weight added
    total_cbm = round(avg_tons * 1.15, 2)

    teu_plan = calculate_container_teu(gross_weight_kg, total_cbm)

    line_items = [
        {
            "item_no": 1,
            "hs_code": hs_code,
            "description": f"{product_desc} - Prime Export Quality with Mill Test Certificate (EN 10204 3.1)",
            "quantity": quantity,
            "unit": "Metric Tons (MT)",
            "unit_price": unit_price,
            "total_amount": total_amount,
            "package_type": package_type,
            "package_count": package_count,
            "net_weight_kg": net_weight_kg,
            "gross_weight_kg": gross_weight_kg,
            "cbm": total_cbm,
            "dimensions": "120cm x 100cm x 95cm per skid",
        }
    ]

    logistics_details = {
        "container_type": teu_plan["container_type"],
        "container_count": teu_plan["container_count"],
        "teu_equivalent": teu_plan["teu_equivalent"],
        "total_packages": package_count,
        "package_type": package_type,
        "total_net_weight_kg": net_weight_kg,
        "total_gross_weight_kg": gross_weight_kg,
        "total_cbm": total_cbm,
        "shipping_marks": f"CONSIGNEE: {buyer_name[:15].upper()} / DEST: {dest_country} / CNTR-01 / MADE IN INDIA",
    }

    today = datetime.now()
    valid_until = today + timedelta(days=30)

    doc_number = _generate_doc_number(db, workspace_id, doc_type)

    notes = (
        "1. Goods are guaranteed to conform to ISO 9001:2015 and Mill Test Certificate specifications.\n"
        "2. Payment via Irrevocable Letter of Credit (L/C at Sight) or 30% T/T Advance + 70% against Bill of Lading.\n"
        "3. Cargo insurance covered up to 110% of CIF invoice value (Institute Cargo Clauses A).\n"
        "4. Country of Origin: India. Statutory Export Declaration applied."
    )

    return {
        "workspace_id": workspace_id,
        "lead_id": lead_id,
        "company_id": company.id,
        "document_type": doc_type,
        "document_number": doc_number,
        "status": "draft",
        "currency": currency,
        "incoterm": incoterm,
        "issue_date": today.strftime("%Y-%m-%d"),
        "validity_date": valid_until.strftime("%Y-%m-%d"),
        "port_of_loading": profile_payload.get("origin_port", "Nhava Sheva (JNPT), India"),
        "port_of_discharge": dest_port,
        "payment_terms": "30% Advance T/T, 70% against B/L Copy & Inspection Certificate",
        "exporter_details": exporter_details,
        "buyer_details": buyer_details,
        "bank_details": bank_details,
        "line_items": line_items,
        "logistics_details": logistics_details,
        "notes": notes,
    }


def generate_document_pdf(doc: CommercialDocument) -> bytes:
    """Generates an official, print-ready, high-resolution vector PDF
    for Proforma Invoices or Commercial Packing Lists using ReportLab.
    """
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.platypus import (
        HRFlowable,
        KeepTogether,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    buffer = io.BytesIO()
    doc_template = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0F172A"),
    )
    sub_title_style = ParagraphStyle(
        "DocSub",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#2563EB"),
    )
    body_bold = ParagraphStyle(
        "BodyBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#1E293B"),
    )
    body_regular = ParagraphStyle(
        "BodyRegular",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#334155"),
    )
    table_head = ParagraphStyle(
        "TableHead",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.white,
    )
    terms_style = ParagraphStyle(
        "TermsStyle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.5,
        leading=10.5,
        textColor=colors.HexColor("#475569"),
    )

    story = []

    is_pi = doc.document_type == "proforma_invoice"
    doc_header_title = "PROFORMA INVOICE" if is_pi else "COMMERCIAL PACKING LIST"
    doc_accent_color = colors.HexColor("#1E3A8A") if is_pi else colors.HexColor("#065F46")

    # Header section: Company Brand / Name on Left, Document Title & Metadata on Right
    exp = doc.exporter_details or {}
    buyer = doc.buyer_details or {}
    bank = doc.bank_details or {}
    logistics = doc.logistics_details or {}

    header_left = [
        Paragraph(f"<b>{exp.get('company_name', 'ForeTrade Global Exports')}</b>", title_style),
        Paragraph(f"{exp.get('address', '')}", body_regular),
        Paragraph(f"Tax ID / GSTIN: <b>{exp.get('tax_id', '')}</b> | IEC: <b>{exp.get('iec_code', '')}</b>", body_regular),
        Paragraph(f"Tel: {exp.get('phone', '')} | Email: {exp.get('email', '')}", body_regular),
    ]

    header_right = [
        Paragraph(f"<b>{doc_header_title}</b>", ParagraphStyle("TitleR", parent=title_style, textColor=doc_accent_color, alignment=2)),
        Paragraph(f"Document No: <b>{doc.document_number}</b>", ParagraphStyle("R1", parent=body_bold, alignment=2)),
        Paragraph(f"Date: <b>{doc.issue_date}</b> | Valid Till: <b>{doc.validity_date}</b>", ParagraphStyle("R2", parent=body_regular, alignment=2)),
        Paragraph(f"Incoterm: <b>{doc.incoterm}</b> ({doc.port_of_discharge})", ParagraphStyle("R3", parent=body_bold, alignment=2, textColor=colors.HexColor("#2563EB"))),
        Paragraph(f"Currency: <b>{doc.currency}</b> | Status: <b>{doc.status.upper()}</b>", ParagraphStyle("R4", parent=body_regular, alignment=2)),
    ]

    header_table = Table([[header_left, header_right]], colWidths=[310, 212])
    header_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ])
    )
    story.append(header_table)
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=doc_accent_color, spaceBefore=0, spaceAfter=8))

    # Parties Section (Consignee / Buyer & Shipment Routing)
    parties_data = [
        [
            Paragraph("<b>CONSIGNEE / BUYER:</b>", sub_title_style),
            Paragraph("<b>SHIPMENT & FREIGHT ROUTING:</b>", sub_title_style),
        ],
        [
            [
                Paragraph(f"<b>{buyer.get('company_name', '')}</b>", body_bold),
                Paragraph(f"Billing: {buyer.get('billing_address', '')}", body_regular),
                Paragraph(f"Shipping: {buyer.get('shipping_address', '')}", body_regular),
                Paragraph(f"Attn: {buyer.get('contact_name', '')} ({buyer.get('email', '')})", body_regular),
                Paragraph(f"Tel: {buyer.get('phone', '')}", body_regular),
            ],
            [
                Paragraph(f"Port of Loading: <b>{doc.port_of_loading}</b>", body_regular),
                Paragraph(f"Port of Discharge: <b>{doc.port_of_discharge}</b>", body_regular),
                Paragraph(f"Final Destination: <b>{buyer.get('country_code', 'Global')}</b>", body_regular),
                Paragraph(f"Container Allocation: <b>{logistics.get('container_type', '1 x 20ft FCL')}</b>", body_bold),
                Paragraph(f"Payment Terms: <b>{doc.payment_terms}</b>", body_regular),
            ],
        ],
    ]
    parties_table = Table(parties_data, colWidths=[261, 261])
    parties_table.setStyle(
        TableStyle([
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ("LINEBEFORE", (1, 0), (1, -1), 0.5, colors.HexColor("#CBD5E1")),
        ])
    )
    story.append(parties_table)
    story.append(Spacer(1, 10))

    # Line Items Table
    raw_items = doc.line_items or []
    subtotal = 0.0
    total_net_kg = 0.0
    total_gross_kg = 0.0
    total_cbm = 0.0

    if is_pi:
        # Columns for Proforma Invoice
        item_headers = [
            Paragraph("Item", table_head),
            Paragraph("HS Code", table_head),
            Paragraph("Description of Goods", table_head),
            Paragraph("Quantity", table_head),
            Paragraph(f"Unit Price ({doc.currency})", table_head),
            Paragraph(f"Total Amount ({doc.currency})", table_head),
        ]
        table_rows = [item_headers]

        for idx, item in enumerate(raw_items, 1):
            qty = float(item.get("quantity", 0))
            price = float(item.get("unit_price", 0))
            tot = float(item.get("total_amount", qty * price))
            subtotal += tot
            total_net_kg += float(item.get("net_weight_kg", 0))
            total_gross_kg += float(item.get("gross_weight_kg", 0))

            table_rows.append([
                Paragraph(str(idx), body_regular),
                Paragraph(str(item.get("hs_code", "")), body_regular),
                Paragraph(str(item.get("description", "")), body_regular),
                Paragraph(f"{qty:,.2f} {item.get('unit', '')}", body_regular),
                Paragraph(f"{price:,.2f}", body_regular),
                Paragraph(f"<b>{tot:,.2f}</b>", body_bold),
            ])

        # Summary footer rows
        table_rows.append([
            "",
            "",
            Paragraph("<b>TOTAL COMMERCIAL VALUE (" + doc.incoterm + ")</b>", body_bold),
            "",
            "",
            Paragraph(f"<b>{doc.currency} {subtotal:,.2f}</b>", ParagraphStyle("TotVal", parent=body_bold, fontSize=10, textColor=doc_accent_color)),
        ])

        col_widths = [30, 55, 227, 80, 65, 65]
    else:
        # Columns for Commercial Packing List
        item_headers = [
            Paragraph("Item", table_head),
            Paragraph("HS Code", table_head),
            Paragraph("Packages & Commodity Description", table_head),
            Paragraph("Pkg Qty", table_head),
            Paragraph("Net Wt (Kg)", table_head),
            Paragraph("Gross Wt (Kg)", table_head),
            Paragraph("Vol (CBM)", table_head),
        ]
        table_rows = [item_headers]

        for idx, item in enumerate(raw_items, 1):
            net_k = float(item.get("net_weight_kg", 0))
            gross_k = float(item.get("gross_weight_kg", 0))
            cbm_v = float(item.get("cbm", 0))
            total_net_kg += net_k
            total_gross_kg += gross_k
            total_cbm += cbm_v

            desc_text = f"{item.get('description', '')}<br/><font color='#64748B'>Pkg: {item.get('package_type', '')} | Dim: {item.get('dimensions', 'Standard')}</font>"
            table_rows.append([
                Paragraph(str(idx), body_regular),
                Paragraph(str(item.get("hs_code", "")), body_regular),
                Paragraph(desc_text, body_regular),
                Paragraph(f"{item.get('package_count', 1)} pkgs", body_regular),
                Paragraph(f"{net_k:,.1f}", body_regular),
                Paragraph(f"<b>{gross_k:,.1f}</b>", body_bold),
                Paragraph(f"{cbm_v:,.2f}", body_regular),
            ])

        # Summary footer rows
        table_rows.append([
            "",
            "",
            Paragraph("<b>TOTAL LOGISTICS WEIGHT & VOLUME</b>", body_bold),
            Paragraph(f"<b>{logistics.get('total_packages', len(raw_items))} pkgs</b>", body_bold),
            Paragraph(f"<b>{total_net_kg:,.1f} kg</b>", body_bold),
            Paragraph(f"<b>{total_gross_kg:,.1f} kg</b>", ParagraphStyle("TotGross", parent=body_bold, textColor=doc_accent_color)),
            Paragraph(f"<b>{total_cbm:,.2f} m³</b>", body_bold),
        ])

        col_widths = [26, 50, 206, 60, 60, 65, 55]

    items_table = Table(table_rows, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), doc_accent_color),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#F1F5F9")),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    story.append(items_table)
    story.append(Spacer(1, 10))

    # Bank Remittance (for P/I) or Container Cargo Manifest details (for Packing List)
    if is_pi and bank:
        bank_grid = [
            [
                Paragraph("<b>BENEFICIARY BANK REMITTANCE COORDINATES (SWIFT / WIRE TRANSFER)</b>", sub_title_style),
            ],
            [
                Paragraph(
                    f"Beneficiary: <b>{bank.get('beneficiary_name', '')}</b> &nbsp;|&nbsp; "
                    f"Bank: <b>{bank.get('bank_name', '')}</b> &nbsp;|&nbsp; "
                    f"Branch: {bank.get('branch', '')}<br/>"
                    f"Account No: <b>{bank.get('account_number', '')}</b> &nbsp;|&nbsp; "
                    f"SWIFT / BIC: <b>{bank.get('swift_code', '')}</b> &nbsp;|&nbsp; "
                    f"IBAN / IFSC: <b>{bank.get('iban', bank.get('ifsc_code', ''))}</b>",
                    terms_style,
                )
            ],
        ]
        bank_table = Table(bank_grid, colWidths=[522])
        bank_table.setStyle(
            TableStyle([
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94A3B8")),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EFF6FF")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ])
        )
        story.append(bank_table)
        story.append(Spacer(1, 8))
    else:
        # Container Manifest details for packing list
        shipping_grid = [
            [
                Paragraph("<b>CONTAINER LOAD & SHIPPING MARKS MANIFEST</b>", sub_title_style),
            ],
            [
                Paragraph(
                    f"Container Specification: <b>{logistics.get('container_type', '1 x 20ft FCL')}</b> &nbsp;|&nbsp; "
                    f"Total TEU Load: <b>{logistics.get('teu_equivalent', 1.0)} TEU</b><br/>"
                    f"Shipping Marks: <b>{logistics.get('shipping_marks', 'N/M')}</b>",
                    terms_style,
                )
            ],
        ]
        shipping_table = Table(shipping_grid, colWidths=[522])
        shipping_table.setStyle(
            TableStyle([
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94A3B8")),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ECFDF5")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ])
        )
        story.append(shipping_table)
        story.append(Spacer(1, 8))

    # Notes, Statutory Declarations & Signatures Block
    notes_text = doc.notes or (
        "Statutory Declaration: We hereby declare that the particulars given in this document are true and correct "
        "and that the cargo originated in India under bilateral WTO export regulations."
    )

    sign_data = [
        [
            [
                Paragraph("<b>STATUTORY DECLARATION & TERMS:</b>", body_bold),
                Paragraph(notes_text.replace("\n", "<br/>"), terms_style),
            ],
            [
                Paragraph(f"For <b>{exp.get('company_name', 'ForeTrade Global Exports')}</b>", body_bold),
                Spacer(1, 30),
                Paragraph("___________________________________", body_regular),
                Paragraph("Authorized Signatory & Official Stamp", body_bold),
            ],
        ]
    ]
    sign_table = Table(sign_data, colWidths=[340, 182])
    sign_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ])
    )
    story.append(KeepTogether(sign_table))

    doc_template.build(story)
    buffer.seek(0)
    return buffer.getvalue()
