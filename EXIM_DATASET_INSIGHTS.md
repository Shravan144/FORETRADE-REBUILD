# EXIM_DatasetAlgo_Hackathon.xlsx — Dataset Insights & Mapping

**Source:** Organizer-provided dataset for PS LOC8A1 (Swipe to Export).  
**File:** `EXIM_DatasetAlgo_Hackathon.xlsx`

---

## 1. Workbook Structure (3 Sheets)

| Sheet Name | Rows | Purpose |
|------------|------|---------|
| **Exporter_LiveSignals_v5_Updated** | 12,000 | Time-series “live” signals per exporter (multiple rows per exporter over time). |
| **Importer_LiveSignals_v5_Updated** | 12,000 | Time-series “live” signals per importer/buyer (multiple rows per buyer over time). |
| **Global_News_LiveSignals_Updated** | 8,000 | Global news/events by date, region, industry (for context and risk adjustment). |

---

## 2. Sheet 1: Exporter_LiveSignals_v5_Updated

**Role:** One row = one exporter on one date (snapshot of signals). Same exporter appears on multiple dates.

### Column Summary

| Column | Type | Description | Nulls | Notes |
|--------|------|-------------|-------|--------|
| Record_ID | int | Unique row id | 0 | |
| Date | object | Signal date | 0 | Use for recency/trends |
| Exporter_ID | object | e.g. EXP_5094 | 0 | **Key for matching** |
| State | object | Indian state | 0 | Rajasthan, Haryana, Punjab, etc. |
| Industry | object | Sector | 0 | **Use for product/industry compatibility** |
| MSME_Udyam | float | MSME flag | 4,016 | 0/1 or NaN |
| Manufacturing_Capacity_Tons | float | Capacity | 6,027 | Many nulls |
| Revenue_Size_USD | int | Revenue | 0 | 503,427 – 79,988,496 |
| Team_Size | int | Headcount | 0 | |
| Certification | object | e.g. ISO9001, ISO14001 | 4,633 | Many nulls |
| Good_Payment_Terms | int | Binary | 0 | 0/1 |
| Prompt_Response_Score | float | 0–1 | 0 | Responsiveness |
| Hiring_Signal | int | Binary | 0 | 0/1 |
| LinkedIn_Activity | int | Count | 0 | |
| SalesNav_ProfileViews | int | Count | 0 | |
| SalesNav_JobChange | int | Binary | 0 | 0/1 |
| **Intent_Score** | float | **0–1** | 0 | **High-intent signal** |
| Shipment_Value_USD | float | Shipment value | 8,063 | Many nulls |
| Quantity_Tons | int | Quantity | 0 | |
| Tariff_Impact | float | Score | 0 | |
| StockMarket_Impact | float | Score | 0 | |
| War_Risk | int | 0/1 | 0 | |
| Natural_Calamity_Risk | int | 0/1 | 0 | |
| Currency_Shift | float | Score | 0 | |

### Key Insights

- **Unique exporters:** 6,682 (so ~1.8 rows per exporter on average).
- **Date range:** 2021-01-01 to 2025-02-09 (good for recency and trends).
- **States (9):** Delhi, Gujarat, Haryana, Karnataka, Maharashtra, Punjab, Rajasthan, Tamil Nadu, Telangana.
- **Industries (10):** Auto Parts, Chemicals, Electronics, Engineering, IT Software, Machinery, Medical Devices, Pharmaceuticals, Solar, Textiles.
- **Intent_Score:** Already provided 0–1; use as a core “high-intent” signal.
- **High-intent / behavior:** Hiring_Signal, LinkedIn_Activity, SalesNav_*, Prompt_Response_Score, Good_Payment_Terms.
- **Risk / external:** Tariff_Impact, StockMarket_Impact, War_Risk, Natural_Calamity_Risk, Currency_Shift.

---

## 3. Sheet 2: Importer_LiveSignals_v5_Updated

**Role:** One row = one importer/buyer on one date (snapshot of signals). Same buyer appears on multiple dates.

### Column Summary

| Column | Type | Description | Nulls | Notes |
|--------|------|-------------|-------|--------|
| Record_ID | int | Unique row id | 0 | |
| Date | object | Signal date | 0 | Use for recency |
| Buyer_ID | object | e.g. BUY_69687 | 598 | **Drop nulls for matching** |
| Country | object | Buyer country | 0 | **Use for geography fit** |
| Industry | object | Sector | 0 | **Use for product/industry compatibility** |
| Avg_Order_Tons | float | Order size | 5,942 | Many nulls |
| Revenue_Size_USD | int | Revenue | 0 | |
| Team_Size | int | Headcount | 0 | |
| Certification | object | e.g. IEC, ISO9001 | 4,526 | Many nulls |
| Good_Payment_History | int | 0/1 | 0 | |
| Prompt_Response | float | 0–1 | 0 | |
| Hiring_Growth | int | 0/1 | 0 | |
| Funding_Event | object | e.g. 1, Unknown | 0 | |
| Engagement_Spike | int | 0/1 | 0 | |
| SalesNav_ProfileVisits | int | Count | 0 | |
| DecisionMaker_Change | int | 0/1 | 0 | |
| **Intent_Score** | float | **0–1** | 0 | **High-intent signal** |
| Preferred_Channel | object | Contact preference | 2,382 | Email, LinkedIn, WhatsApp, Call |
| Response_Probability | float | 0–1 | 8,047 | Many nulls |
| Tariff_News | int | 0/1 | 0 | |
| StockMarket_Shock | int | 0/1 | 0 | |
| War_Event | int | 0/1 | 0 | |
| Natural_Calamity | int | 0/1 | 0 | |
| Currency_Fluctuation | float | Score | 0 | |

### Key Insights

- **Unique buyers:** 10,695 (after dropping null Buyer_ID).
- **Date range:** 2021-01-01 to 2025-02-09.
- **Countries (11 sample):** Australia, Canada, France, Germany, Italy, Japan, Netherlands, Singapore, UAE, UK, USA.
- **Industries (10):** Same as exporter (Auto Parts, Chemicals, Electronics, Engineering, IT Software, Machinery, Medical Devices, Pharmaceuticals, Solar, Textiles) — **ideal for industry-based matching**.
- **Intent_Score:** 0–1; use as core buyer intent.
- **Outreach:** Preferred_Channel (Email, LinkedIn, WhatsApp, Call) — use for “outreach-ready” flow.
- **High-intent:** Hiring_Growth, Funding_Event, Engagement_Spike, DecisionMaker_Change, Prompt_Response.

---

## 4. Sheet 3: Global_News_LiveSignals_Updated

**Role:** External events by date/region/industry for context and risk adjustment.

### Column Summary

| Column | Type | Description | Nulls |
|--------|------|-------------|-------|
| News_ID | int | Row id | 0 |
| Date | object | Event date | 0 |
| Region | object | Asia, Global, Middle East, Europe, North America | 0 |
| Event_Type | object | Type of event | 0 |
| Impact_Level | object | Low, Medium, High | 0 |
| Affected_Industry | object | Industry tag | 0 |
| Tariff_Change | float | Score | 0 |
| StockMarket_Shock | float | Score | 0 |
| War_Flag | int | 0/1 | 0 |
| Natural_Calamity_Flag | int | 0/1 | 0 |
| Currency_Shift | float | Score | 0 |

### Key Insights

- **Event_Type:** Supply Chain Shock, Trade Agreement, Tariff Update, Stock Crash, Natural Calamity, War Alert.
- **Impact_Level:** Low, Medium, High.
- **Affected_Industry:** Same 10 industries as exporter/importer.
- **Use case:** Join by Date + Region/Industry to adjust exporter/buyer scores (e.g. lower weight in high-risk periods or boost in positive trade agreement periods).

---

## 5. Mapping to ForeTrade Concepts

| ForeTrade concept | EXIM dataset source |
|-------------------|----------------------|
| **Exporter id** | `Exporter_ID` (e.g. EXP_5094) |
| **Buyer id** | `Buyer_ID` (e.g. BUY_69687) |
| **Product / compatibility** | **Industry** (same industry = strong product fit) |
| **Geography** | Exporter `State` (India) ↔ Importer `Country`; can map State→Region and use region affinity |
| **Trade frequency / volume** | Exporter: `Shipment_Value_USD`, `Quantity_Tons`; Importer: `Avg_Order_Tons` (with nulls handled) |
| **Buyer activity / recency** | Use latest `Date` per buyer and `Intent_Score`; optional: Engagement_Spike, DecisionMaker_Change |
| **High-intent signals** | **Intent_Score** (both sides), Hiring_Signal, Hiring_Growth, Funding_Event, Prompt_Response, etc. |
| **Real-time / adaptability** | Multiple dates per entity → use “latest” or “recent window” and optionally Global_News to adjust |

**Important:** There is **no explicit transaction table** (no exporter–buyer pairs). So:

- **Matching is inference-based:** e.g. same Industry + geography fit + intent scores.
- **“Transactions” for a graph** can be **synthetic** (e.g. link exporter to buyer if same industry + same region/country and high intent) or you can skip graph and use only feature-based scoring.

---

## 6. Data Quality Summary

| Issue | Where | Suggestion |
|-------|--------|------------|
| Missing Buyer_ID | Importer (598) | Drop those rows before matching. |
| Many nulls | MSME_Udyam, Manufacturing_Capacity_Tons, Certification (both), Avg_Order_Tons, Response_Probability, Shipment_Value_USD | Median/mode fill or “unknown”; avoid using as primary signals where nulls are high. |
| Date as object | All sheets | Convert to `datetime` for recency and joins. |
| Duplicate entities over time | Exporter & Importer | Aggregate to “latest” or “max intent in last N days” per entity for matchmaking. |

---

## 7. Recommended Use in Algorithm

1. **Cleaning**
   - Drop importer rows with null `Buyer_ID`.
   - Convert `Date` to datetime.
   - Fill critical nulls (e.g. Intent_Score keep; fill optional fields with median/mode).

2. **High-intent**
   - Use **Intent_Score** (both sides) as primary.
   - Add: Hiring_Signal / Hiring_Growth, Prompt_Response, Engagement_Spike, Funding_Event (if clean).

3. **Scoring**
   - **Product compatibility:** Industry match (exporter Industry == buyer Industry).
   - **Geography:** State–Country or Region–Country affinity (you can define a simple mapping).
   - **Trade frequency/activity:** Use Shipment_Value_USD / Quantity_Tons (exporter) and Avg_Order_Tons (buyer) where not null; else skip or use Intent_Score.
   - **Buyer activity:** Recency of latest Date + Intent_Score + optional Engagement_Spike.

4. **Real-time adaptability**
   - Take “latest” row per Exporter_ID and per Buyer_ID (or latest in last 90 days).
   - Optionally join Global_News by date/region/industry and add a small “risk/opportunity” adjustment to scores.

5. **Outreach**
   - Use **Preferred_Channel** (Email, LinkedIn, WhatsApp, Call) in the outreach panel.

---

## 8. Quick Reference — Column Names

**Exporter:** Record_ID, Date, Exporter_ID, State, Industry, MSME_Udyam, Manufacturing_Capacity_Tons, Revenue_Size_USD, Team_Size, Certification, Good_Payment_Terms, Prompt_Response_Score, Hiring_Signal, LinkedIn_Activity, SalesNav_ProfileViews, SalesNav_JobChange, Intent_Score, Shipment_Value_USD, Quantity_Tons, Tariff_Impact, StockMarket_Impact, War_Risk, Natural_Calamity_Risk, Currency_Shift  

**Importer:** Record_ID, Date, Buyer_ID, Country, Industry, Avg_Order_Tons, Revenue_Size_USD, Team_Size, Certification, Good_Payment_History, Prompt_Response, Hiring_Growth, Funding_Event, Engagement_Spike, SalesNav_ProfileVisits, DecisionMaker_Change, Intent_Score, Preferred_Channel, Response_Probability, Tariff_News, StockMarket_Shock, War_Event, Natural_Calamity, Currency_Fluctuation  

**Global_News:** News_ID, Date, Region, Event_Type, Impact_Level, Affected_Industry, Tariff_Change, StockMarket_Shock, War_Flag, Natural_Calamity_Flag, Currency_Shift  

---

---

## 9. Using This Dataset in ForeTrade

1. **Copy the Excel** into a known path (e.g. project folder or path in `load_exim_hackathon_dataset.py`).
2. **Run the loader:**
   ```bash
   # From project root; set EXIM_XLSX_PATH if the file is elsewhere
   python data/load_exim_hackathon_dataset.py
   ```
   This overwrites `data/exporters.csv`, `data/buyers.csv`, `data/transactions.csv` and creates `data/global_news.csv`.
3. **Run the app as usual:** `streamlit run app.py`. The app will load the CSVs produced from the real dataset.
4. **Industry = “product”:** In the loader, `Industry` is mapped to `primary_hs` / `interested_hs`. Our compatibility logic treats same industry as strong product match.

---

*Use this document to align your cleaning, scoring, and matching logic with the actual EXIM hackathon dataset.*
