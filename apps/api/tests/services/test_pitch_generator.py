import pytest
from app.services.ml.pitch_generator import generate_export_pitch


def test_pitch_generator_email_channel():
    buyer = {
        "company_name": "Al-Futtaim Logistics",
        "contact_name": "Tariq Al-Mansoor",
        "country_code": "AE",
        "city": "Dubai (Jebel Ali)",
        "primary_sector": "Cotton T-Shirts & Apparel",
        "annual_import_volume_usd": 4200000.0,
        "avg_order_tons": 65.0,
        "required_certifications": ["ISO 9001", "OEKO-TEX Standard 100"],
        "preferred_incoterms": "CIF",
        "customs_manifest_provenance": "Dubai Customs Sea Cargo Manifest",
        "hs_codes": ["610910"],
    }
    exporter = {
        "company_name": "Apex Garments Exports",
        "capacity_tons": 250.0,
        "certifications": ["ISO 9001", "OEKO-TEX Standard 100", "WRAP"],
        "origin_port": "Nhava Sheva (JNPT)",
    }
    tariff = {
        "agreement_name": "India-UAE CEPA",
        "tariff_savings_pct": 5.0,
        "preferential_rate_pct": 0.0,
    }

    result = generate_export_pitch(
        buyer_data=buyer,
        exporter_profile=exporter,
        tariff_data=tariff,
        channel="email",
        custom_notes="Offer 18-day direct sea delivery guarantee.",
    )

    assert "subject" in result and len(result["subject"]) > 5
    assert "body" in result and len(result["body"]) > 50
    assert result["channel"] == "email"
    assert "Al-Futtaim Logistics" in result["body"] or "Tariq" in result["body"]
    assert "India-UAE CEPA" in result["body"] or "tariff" in result["body"].lower()


def test_pitch_generator_linkedin_channel():
    buyer = {
        "company_name": "Nordic Retail AB",
        "contact_name": "Astrid Lind",
        "country_code": "SE",
        "primary_sector": "Organic Textiles",
        "annual_import_volume_usd": 1500000.0,
        "avg_order_tons": 25.0,
    }
    exporter = {
        "company_name": "GreenWeave India",
        "capacity_tons": 100.0,
        "certifications": ["GOTS Organic", "ISO 9001"],
        "origin_port": "Chennai Port",
    }

    result = generate_export_pitch(
        buyer_data=buyer,
        exporter_profile=exporter,
        channel="linkedin",
    )

    assert result["channel"] == "linkedin"
    assert "Nordic Retail AB" in result["subject"]
    assert len(result["body"]) < 2500  # LinkedIn pitch should be concise


def test_pitch_generator_proposal_channel():
    buyer = {
        "company_name": "Trans-Pacific Auto Spares",
        "contact_name": "David Miller",
        "country_code": "US",
        "city": "Los Angeles (Long Beach)",
        "primary_sector": "Automotive Transmission Components",
        "annual_import_volume_usd": 8500000.0,
        "avg_order_tons": 120.0,
        "required_certifications": ["IATF 16949", "ISO 14001"],
        "preferred_incoterms": "FOB",
        "customs_manifest_provenance": "US Customs AMS Inward Manifest",
        "hs_codes": ["870829"],
    }
    exporter = {
        "company_name": "Precision Castings India Ltd",
        "capacity_tons": 500.0,
        "certifications": ["IATF 16949", "ISO 9001", "ISO 14001"],
        "origin_port": "Mundra Port",
    }

    result = generate_export_pitch(
        buyer_data=buyer,
        exporter_profile=exporter,
        channel="proposal",
    )

    assert result["channel"] == "proposal"
    assert "COMMERCIAL EXPORT PROPOSAL" in result["body"]
    assert "Trans-Pacific Auto Spares" in result["body"]
    assert "IATF 16949" in result["body"]
