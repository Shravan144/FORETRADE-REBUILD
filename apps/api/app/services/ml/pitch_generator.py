"""
Model 4: AI Export Pitch & Outreach Generator
Synthesizes verified customs Bill of Lading (BoL) data, exporter production capacity,
certifications, and bilateral WTO/FTA tariff differentials into high-converting B2B outreach proposals.
Supports optional Google Gemini API enhancement with guaranteed deterministic template synthesis fallback.
"""

import os
import json
from typing import Any, Dict, List, Optional


def generate_export_pitch(
    buyer_data: Dict[str, Any],
    exporter_profile: Dict[str, Any],
    tariff_data: Optional[Dict[str, Any]] = None,
    channel: str = "email",  # "email" | "linkedin" | "proposal"
    pitch_angle: str = "cost_duty",  # "cost_duty" | "reliability_compliance" | "speed_trial"
    custom_notes: Optional[str] = None,
) -> Dict[str, str]:
    """
    Synthesize buyer BoL signals + exporter capacity + tariff savings into a commercial outreach pitch.
    Returns: {"subject": str, "body": str, "channel": str, "model_used": str}
    """
    buyer_name = buyer_data.get("company_name") or buyer_data.get("name") or "Procurement Partner"
    contact_name = buyer_data.get("contact_name") or "Procurement Director"
    contact_title = buyer_data.get("contact_title") or "Global Sourcing Director"
    country_code = buyer_data.get("country_code") or "Target Market"
    city = buyer_data.get("city") or "Main Port"
    sector = buyer_data.get("primary_sector") or buyer_data.get("product_or_industry") or "General Goods"
    vol_usd = buyer_data.get("annual_import_volume_usd") or (buyer_data.get("attributes", {}).get("annual_import_volume_usd")) or 0.0
    order_tons = buyer_data.get("avg_order_tons") or (buyer_data.get("attributes", {}).get("avg_order_tons")) or 50.0
    req_certs = buyer_data.get("required_certifications") or (buyer_data.get("attributes", {}).get("required_certifications")) or ["ISO 9001"]
    incoterm = buyer_data.get("preferred_incoterms") or (buyer_data.get("attributes", {}).get("preferred_incoterms")) or "CIF"
    manifest = buyer_data.get("customs_manifest_provenance") or (buyer_data.get("attributes", {}).get("customs_provenance")) or "Customs Bill of Lading Manifest"
    hs_codes = buyer_data.get("hs_codes") or []
    primary_hs = hs_codes[0] if hs_codes else "6109"

    # Exporter context
    exp_name = exporter_profile.get("company_name") or "Global Export Manufacturer"
    exp_capacity = exporter_profile.get("capacity_tons") or 150.0
    exp_certs = exporter_profile.get("certifications") or ["ISO 9001"]
    exp_port = exporter_profile.get("origin_port") or "Nhava Sheva (JNPT) / Mundra"

    # Tariff & FTA context
    agreement_name = (tariff_data or {}).get("agreement_name") or "Standard WTO Most-Favored-Nation (MFN)"
    tariff_savings = (tariff_data or {}).get("tariff_savings_pct") or 0.0
    pref_rate = (tariff_data or {}).get("preferential_rate_pct") or 0.0

    angle_instruction = {
        "cost_duty": f"Emphasize commercial arbitrage, lower landed cost, and duty savings under {agreement_name} ({tariff_savings:.1f}% duty advantage, preferential rate {pref_rate:.1f}%). Highlight direct manufacturer pricing and flexible {incoterm} terms.",
        "reliability_compliance": f"Emphasize strict regulatory compliance, mandatory certifications ({', '.join(req_certs)}), accredited third-party lab assays, and consistent throughput reliability from {exp_port} to prevent destination customs delays.",
        "speed_trial": f"Emphasize a low-friction pilot container consignment (1 TEU / ~{min(order_tons, 20.0):.0f} tons) with expedited 14-day production turnaround, CAD/LC payment security, and pre-cleared physical sample kits.",
    }.get(pitch_angle, "Emphasize overall supply capability and commercial fit.")

    prompt = f"""You are ForeTrade's senior cross-border export trade advisor.
Write an authentic, highly persuasive B2B export pitch for an Indian exporter reaching out to a verified overseas buyer.

Target Decision-Maker:
- Contact Name: {contact_name}
- Title / Role: {contact_title}
- Company: {buyer_name} ({country_code}, {city})
- Product Sector: {sector} (HS {primary_hs})
- Annual Import Volume: ${vol_usd:,.0f} USD
- Typical Order Consignment: {order_tons} Tons ({incoterm})
- Required Standards: {', '.join(req_certs)}
- Customs Provenance: {manifest}

Exporter Profile:
- Company: {exp_name} (India)
- Monthly Production Capacity: {exp_capacity} Tons
- Quality Certifications Held: {', '.join(exp_certs)}
- Preferred Export Port: {exp_port}

Commercial Strategy:
- Selected Pitch Angle: {pitch_angle.upper()}
- Strategic Angle Focus: {angle_instruction}
- Bilateral Trade Framework: {agreement_name}
{f'- Exporter Special Instructions: {custom_notes}' if custom_notes else ''}

Channel: {channel} (Format: Return a JSON object with 'subject' and 'body' keys).
Do not use generic buzzwords. Address {contact_name} directly with appropriate professional salutation. Reference their customs arrival port and import profile to establish immediate commercial authority.
"""

    # 1. Try OpenRouter (e.g. NVIDIA Nemotron 3 Ultra) if API key available
    openrouter_key = os.getenv("OPENROUTER_API_KEY")
    if not openrouter_key:
        from dotenv import load_dotenv
        from pathlib import Path
        load_dotenv(Path(__file__).resolve().parents[4] / ".env")
        openrouter_key = os.getenv("OPENROUTER_API_KEY")

    if openrouter_key:
        try:
            import requests

            model_name = os.getenv("OPENROUTER_MODEL", "nvidia/nemotron-3-ultra-550b-a55b:free")
            payload = {
                "model": model_name,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are ForeTrade's senior cross-border export trade advisor. "
                            "You MUST output valid, parseable JSON only with exactly two keys: 'subject' (string) and 'body' (string). "
                            "Do not include markdown code block syntax (no ```json or ```). Return pure JSON text only."
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.3,
                "reasoning": {"enabled": True},
            }
            resp = requests.post(
                url="https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {openrouter_key}",
                    "HTTP-Referer": "https://foretrade.ai",
                    "X-Title": "ForeTrade Cross-Border Intelligence",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=90,
            )
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"].strip()
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0].strip()
                parsed = json.loads(content)
                if "subject" in parsed and "body" in parsed:
                    return {
                        "subject": parsed["subject"],
                        "body": parsed["body"],
                        "channel": channel,
                        "model_used": model_name,
                    }
            else:
                import logging
                logging.warning(f"OpenRouter returned status {resp.status_code}: {resp.text[:200]}")
        except Exception as exc:
            import logging
            logging.warning(f"OpenRouter pitch generation error: {exc}")
            # Fall through to Gemini or deterministic synthesizer
            pass

    # 2. Try Gemini if API key available
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if gemini_key:
        try:
            import urllib.request
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}"
            req_data = json.dumps({
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"response_mime_type": "application/json"}
            }).encode("utf-8")
            req = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=8) as response:
                resp_json = json.loads(response.read().decode("utf-8"))
                text = resp_json["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text)
                if "subject" in parsed and "body" in parsed:
                    return {
                        "subject": parsed["subject"],
                        "body": parsed["body"],
                        "channel": channel,
                        "model_used": "gemini-2.0-flash",
                    }
        except Exception:
            # Fall through to deterministic synthesizer
            pass

    # Deterministic Specialized Commercial Synthesis Engine
    vol_str = f"${vol_usd / 1_000_000:.1f}M USD" if vol_usd >= 1_000_000 else f"${vol_usd:,.0f} USD" if vol_usd > 0 else "multi-container"

    if channel == "linkedin":
        subject = f"Supply Partnership Inquiry — {exp_name} × {buyer_name}"
        body = f"""Hi {contact_name.split()[0] if contact_name else 'there'},

I noticed {buyer_name}'s regular container procurement across {sector} via {manifest.split('Manifest')[0].strip() or 'customs manifests'}.

At {exp_name}, we manufacture certified {sector.lower()} operating at {exp_capacity:,.0f} Tons/month capacity from {exp_port}, holding {', '.join(exp_certs[:3])}. We are configured specifically to service order batches of {order_tons:,.0f} Tons on {incoterm} terms.

{f'Under {agreement_name}, direct shipments from our certified facility qualify for {tariff_savings:.1f}% preferential tariff savings.' if tariff_savings > 0 else f'We provide full origin documentation and pre-cleared testing certificates for every container.'}

Would you be open to a 10-minute introductory call next Tuesday to review our Q4 spec sheets and sample batch options?

Best regards,
{exp_name} Export Procurement Desk"""
        return {"subject": subject, "body": body.strip(), "channel": channel, "model_used": "foretrade-commercial-rules-engine"}

    elif channel == "proposal":
        subject = f"Commercial Supply & Export Briefing: {sector} Procurement — {exp_name} for {buyer_name}"
        body = f"""======================================================================
COMMERCIAL EXPORT PROPOSAL & SUPPLY CAPABILITIES BRIEFING
Target Importer: {buyer_name} ({country_code})
Attention: {contact_name}
Prepared by: {exp_name} (India)
Reference: Customs Provenance Record ({manifest})
======================================================================

1. EXECUTIVE SUMMARY & STRATEGIC ALIGNMENT
We have analyzed {buyer_name}'s customs import profile indicating annual procurement demand of ~{vol_str} in {sector} (HS Code {primary_hs}). Our production facilities in India are uniquely positioned to serve as a reliable, direct Tier-1 manufacturing partner.

2. PRODUCTION CAPACITY & ORDER BATCH FIT
• Monthly Certified Capacity: {exp_capacity:,.0f} Metric Tons
• Buyer Typical Order Size: {order_tons:,.0f} Metric Tons (Optimal {exp_capacity / max(order_tons, 1.0):.1f}x capacity buffer)
• Load Port / Gateway: {exp_port}
• Preferred Incoterms: {incoterm} (Direct Port-to-Port routing)
• Dispatch Cycle: 15–21 days from purchase order confirmation

3. REGULATORY COMPLIANCE & ACCREDITATIONS
To satisfy {buyer_name}'s mandatory procurement pre-qualifications:
• Mandated Standards Addressed: {', '.join(req_certs)}
• Accreditations Held: {', '.join(exp_certs)}
• Batch Traceability: Complete Mill Test Certificate (MTC) & Independent Lab Assay with each Bill of Lading.

4. TARIFF & LANDED-COST ADVANTAGE
• Trade Framework: {agreement_name}
{f'• Duty Arbitrage: Direct export from our certified origin delivers a {tariff_savings:.1f}% preferential tariff reduction compared to standard MFN rates.' if tariff_savings > 0 else '• Standard MFN customs classification with complete non-preferential certificate of origin.'}
• Quality Assurance: Zero discrepancy customs documentation guaranteeing expedited clearance at destination port.

5. NEXT STEPS & PROPOSED ACTION
We would be pleased to dispatch a physical sample kit and our complete technical specification catalog. 

May we arrange an introductory teleconference with your sourcing team next week?

Authorized Signatory,
Export Directorate | {exp_name}
Direct: export-desk@{exp_name.lower().replace(' ', '')}.com"""
        return {"subject": subject, "body": body.strip(), "channel": channel, "model_used": "foretrade-commercial-rules-engine"}

    else:
        # Standard Cold B2B Outreach Email with Multi-Angle Commercial Focus
        if pitch_angle == "reliability_compliance":
            subject = f"[Verified Compliance] Pre-Certified {sector} Supply for {buyer_name} ({', '.join(exp_certs[:2])})"
            body = f"""Dear {contact_name},

I am reaching out to you regarding {buyer_name}'s procurement operations in {city} ({country_code}).

From recent customs Bill of Lading records ({manifest}), we noted your recurring import schedule for {sector} (HS {primary_hs}). As {contact_title}, ensuring regulatory compliance, strict specifications, and zero-defect consignments is vital for your operations.

At {exp_name}, our Indian manufacturing facilities are engineered specifically to meet your mandatory standards:

1. Regulatory Pre-Qualifications Addressed:
We hold active {', '.join(exp_certs)}, fully satisfying your mandatory requirements ({', '.join(req_certs)}). Every container is accompanied by third-party laboratory inspection certificates and certified Mill Test Reports (MTC).

2. Guaranteed Throughput & Capacity Buffer:
With a monthly throughput capacity of {exp_capacity:,.0f} Tons from {exp_port}, we can readily service your {order_tons:,.0f}-ton shipping batches with guaranteed dispatch intervals, eliminating port demurrage and warehousing stockouts.

3. Complete Provenance & Chain of Custody:
Direct factory-to-port loading ensures pristine cargo handling, intact container seals, and pre-cleared origin documentation under {incoterm} terms.

May we send our complete technical dossier, QA audit records, and lab testing certifications for your team's evaluation?

Warm regards,

Export Quality & Technical Directorate
{exp_name}
Port of Lading: {exp_port}
Website: www.{exp_name.lower().replace(' ', '')}.com
Email: sales-export@{exp_name.lower().replace(' ', '')}.com"""

        elif pitch_angle == "speed_trial":
            trial_tons = min(order_tons, 20.0)
            subject = f"[Expedited Trial] 1-Container Pilot Consignment of {sector} to {city} Port"
            body = f"""Dear {contact_name},

I hope this message finds you well. I am writing from {exp_name}, an established export manufacturing enterprise based in India.

We are familiar with {buyer_name}'s procurement schedule in {sector} and regular shipment consignments via {manifest.split('Manifest')[0].strip() or city}. Rather than proposing a full annual volume commitment upfront, we would like to propose a low-friction, zero-risk trial order:

1. 1-Container Pilot Consignment:
We can prepare a test container of {trial_tons:,.0f} Metric Tons (1 TEU) of certified {sector} configured to your exact technical specifications.

2. Expedited Dispatch Turnaround:
Shipment dispatched directly from {exp_port} within 14–18 business days from purchase order confirmation.

3. Low-Risk Commercial Terms:
We offer flexible trial payment terms (Cash Against Documents - CAD or 30-day deferred LC) on {incoterm} terms, accompanied by pre-shipment lab assay testing.

Would you be open to receiving a physical sample swatch/kit and our technical specification sheet this week?

Warm regards,

Export Sourcing Desk
{exp_name}
Port of Lading: {exp_port}
Website: www.{exp_name.lower().replace(' ', '')}.com
Email: sales-export@{exp_name.lower().replace(' ', '')}.com"""

        else:
            # Default: cost_duty angle
            subject = f"[FTA Verified Supply] {tariff_savings:.1f}% Tariff Advantage on Direct {sector} to {buyer_name} ({incoterm})" if tariff_savings > 0 else f"[Direct Factory Supply] Direct {sector} Consignments to {buyer_name} ({incoterm} terms)"
            body = f"""Dear {contact_name},

I am writing to you on behalf of {exp_name}, an established export manufacturing enterprise based in India. 

Based on public customs manifest data for {country_code}, we understand that {buyer_name} consistently imports {sector} (HS {primary_hs}) with annual procurement volumes of ~{vol_str} and typical order consignments of {order_tons:,.0f} Tons.

We specialize in high-spec production for overseas distributors and would like to propose a direct supply relationship with the following key commercial advantages:

1. Tariff & Landed-Cost Arbitrage:
{f'Under {agreement_name}, our shipments qualify for preferential duty rates ({pref_rate:.1f}%), yielding a direct {tariff_savings:.1f}% landed-cost duty savings over alternative origin hubs.' if tariff_savings > 0 else f'Shipments routed directly from {exp_port} provide competitive ocean freight rates and guaranteed sailing schedules.'}

2. Operational Batch Alignment:
Our facility maintains a monthly throughput capacity of {exp_capacity:,.0f} Tons. We can seamlessly service your {order_tons:,.0f}-ton shipping cycles without bottlenecking your regional warehousing schedules.

3. Stringent Quality Compliance:
We hold active {', '.join(exp_certs)}, fully satisfying your mandatory requirements ({', '.join(req_certs)}). Every container is accompanied by a certified Certificate of Origin and third-party laboratory inspection reports.

4. Commercial Terms:
We offer {incoterm} pricing with flexible 30-day deferred payment terms (against confirmed Irrevocable LC or CAD) for pre-qualified buyers.

Could we send our comprehensive 2025/26 product catalog and pricing matrix for your upcoming procurement review?

Thank you for your time and consideration.

Warm regards,

Export Sourcing Desk
{exp_name}
Port of Lading: {exp_port}
Website: www.{exp_name.lower().replace(' ', '')}.com
Email: sales-export@{exp_name.lower().replace(' ', '')}.com"""

        return {"subject": subject, "body": body.strip(), "channel": "email", "model_used": "foretrade-commercial-rules-engine"}
