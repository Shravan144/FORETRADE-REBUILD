# 🏆 ForeTrade - 24-Hour Hackathon Execution Plan

## 📋 Problem Statement Summary

**PS ID: LOC8A1 - Swipe to Export: Intelligent Matchmaking Algorithm for Global Trade**

### Core Requirements:
1. ✅ **Data Cleaning & Normalization** - Handle messy EXIM data
2. ✅ **Multi-Signal Scoring** - Product compatibility, geography, frequency, activity, graph affinity
3. ✅ **Real-Time Adaptability** - System learns from user swipes
4. ✅ **Explainable Scoring** - Clear reasoning for each match
5. ✅ **Swipe-Style UI** - Tinder-like interface for match browsing
6. ✅ **Visual Workflow** - Show how algorithm works
7. ✅ **Outreach-Ready Outputs** - Email templates, contact info

---

## 🎯 Your Solution Approach (From Presentation)

Based on your presentation, you're building:
- **Behavioral Pattern Encoding** - Trade patterns → behavioral fingerprints
- **Graph-Based Compatibility** - NetworkX for structural similarity
- **Confidence-Calibrated Scoring** - Multi-factor weighted scoring
- **Intent Acceleration** - Temporal gradient for demand momentum
- **Adaptive Weights** - Continuous adjustment based on market drifts

---

## ⏰ Hour-by-Hour Execution Plan

### **HOUR 0-1: Setup & Data Generation** ⚡ CRITICAL FIRST STEP
**Team Split:** Everyone together
- [ ] Activate virtual environment: `.venv\Scripts\activate` (Windows)
- [ ] Install dependencies: `pip install -r requirements.txt`
- [ ] Generate synthetic data: `python data/generate_synthetic.py`
- [ ] Verify CSVs created: Check `data/exporters.csv`, `data/buyers.csv`, `data/transactions.csv`
- [ ] Test basic app: `streamlit run app.py` (should show sidebar + placeholder)

**Deliverable:** Working environment + data files ready

---

### **HOUR 1-3: Data Cleaning Pipeline** 🧹
**Team:** Pair A (Backend)
**Files:** `engine/cleaner.py`

**Tasks:**
1. Implement `clean_transactions()`:
   - Drop rows with missing exporter_id/buyer_id
   - Fill missing trade_value with median
   - Fill missing quantity with median
   - Convert date to datetime
   - Remove outliers (negative values, top 1%)
   - Normalize trade_value (MinMaxScaler)

2. Implement `clean_exporters()`:
   - Remove duplicates
   - Fill missing employees with median
   - Normalize annual_volume

3. Implement `clean_buyers()`:
   - Remove duplicates
   - Map import_frequency to numeric scores
   - Compute activity_score from last_active_days

4. Implement `detect_high_intent_buyers()`:
   - Calculate recency score (last 90 days)
   - Calculate frequency score (transactions in last 6 months)
   - Calculate growth trend (increasing trade values)
   - Combine: `intent_score = 0.4*recency + 0.3*frequency + 0.3*growth`

**Test:** Run cleaning functions, verify no errors, check output shapes

---

### **HOUR 3-5: Feature Engineering** 🔬
**Team:** Pair A (Backend)
**Files:** `engine/features.py`

**Tasks:**
1. Implement `build_exporter_profiles()`:
   - Group transactions by exporter_id
   - Compute: total_trade_volume, avg_trade_value, num_transactions
   - Compute: num_unique_buyers, num_unique_countries
   - Find primary_product (most traded HS code)
   - Calculate trade_recency (days since last transaction)
   - Calculate growth_trend (slope of monthly volume)

2. Implement `build_buyer_profiles()`:
   - Similar aggregation for buyers
   - Add region mapping using COUNTRY_TO_REGION

3. Implement `compute_compatibility()`:
   - **product_match**: Exact HS match = 1.0, same chapter = 0.7, related = 0.3
   - **geography_score**: Use CORRIDOR_STRENGTH from constants
   - **trade_frequency_match**: Normalize exporter vs buyer frequency
   - **activity_score**: Based on buyer's last_active_days + intent_score

**Test:** Generate profiles, verify compatibility scores are 0-1 range

---

### **HOUR 5-7: Graph-Based Affinity** 🕸️
**Team:** Pair A (Backend)
**Files:** `engine/graph.py`

**Tasks:**
1. Implement `build_trade_graph()`:
   - Create NetworkX Graph
   - Add edges between exporters and buyers who traded
   - Edge weight = total trade value
   - Add node attributes (type: exporter/buyer)

2. Implement `compute_graph_affinity()`:
   - If direct edge exists → return 0.9
   - Use Jaccard coefficient: `nx.jaccard_coefficient(G, [(exp, buy)])`
   - Scale result to 0-1 range

3. Implement `get_graph_stats()`:
   - Return basic stats for dashboard

**Test:** Build graph, verify nodes/edges count, test affinity scores

---

### **HOUR 7-9: Scoring Engine** ⚖️ THE BRAIN
**Team:** Pair A (Backend)
**Files:** `engine/scorer.py`

**Tasks:**
1. Implement `compute_match_score()`:
   - Formula: `score = Σ(weight_i × signal_i) × 100`
   - Compute breakdown dict with raw, weight, contribution for each signal
   - Return (final_score, breakdown)

2. Implement `rank_matches_for_exporter()`:
   - Loop through all buyers
   - For each: compute compatibility + graph affinity + match score
   - Filter by MIN_MATCH_SCORE
   - Sort by score descending
   - Return top K matches

3. Implement `update_weights_from_swipe()`:
   - Find top contributing signal from breakdown
   - Adjust weight: +0.05 for right swipe, -0.03 for left swipe
   - Store in `_weight_adjustments`

**Test:** Score some matches manually, verify scores are reasonable (30-90 range)

---

### **HOUR 9-11: Integration & UI Foundation** 🔌
**Team:** Both pairs together
**Files:** `app.py`, `engine/explainer.py`

**Tasks:**
1. Implement `explainer.py`:
   - `generate_explanation()`: Create human-readable match explanations
   - `generate_match_card_text()`: Generate card display text

2. Wire up `app.py`:
   - Uncomment all imports
   - Call cleaning pipeline in `load_data()`
   - Build profiles and graph
   - Generate matches in `page_swipe()`
   - Display matches (even if just as list for now)

**Test:** App should show matches when exporter selected!

---

### **HOUR 11-13: Swipe UI** 📱
**Team:** Pair B (Frontend)
**Files:** `ui/swipe.py`

**Tasks:**
1. Implement `render_swipe_card()`:
   - Create styled card with buyer info
   - Show score, badge, highlight text
   - Add "Why this match?" expander with explanation
   - Add Skip/Connect buttons
   - Return "left" or "right" on button click

2. Implement `render_swipe_interface()`:
   - Track card_index in session_state
   - Show current match card
   - Handle swipe actions (update session_state, call update_weights_from_swipe)
   - Show "all matches reviewed" message

3. Add `inject_card_css()` for styling

**Test:** Swipe through matches, verify buttons work, check session state updates

---

### **HOUR 13-15: Dashboard & Analytics** 📊
**Team:** Pair B (Frontend)
**Files:** `ui/dashboard.py`

**Tasks:**
1. Implement `render_match_analytics()`:
   - Score distribution histogram (Plotly)
   - Top 10 matches bar chart
   - Country distribution pie chart
   - Signal contribution stacked bar

2. Implement `render_algorithm_workflow()`:
   - Visual flowchart (markdown + emojis is fine)
   - Show scoring formula
   - Explain real-time adaptability

3. Wire up Analytics page in `app.py`

**Test:** Navigate to Analytics page, verify charts render

---

### **HOUR 15-17: Outreach & Polish** ✨
**Team:** Pair B (Frontend)
**Files:** `ui/dashboard.py`, `app.py`

**Tasks:**
1. Implement `render_outreach_panel()`:
   - Show connected buyers list
   - Generate email templates
   - Add "Copy Email" and "LinkedIn" buttons (simulated)

2. Polish UI:
   - Improve card styling
   - Add color coding for scores
   - Make responsive
   - Add loading indicators

3. Wire up Outreach page in `app.py`

**Test:** Swipe right on matches, check Outreach page shows them

---

### **HOUR 17-19: Testing & Bug Fixes** 🐛
**Team:** Everyone

**Tasks:**
- [ ] Test with different exporters
- [ ] Test weight sliders (verify matches change)
- [ ] Test swipe feedback loop (verify weights adjust)
- [ ] Test edge cases (no matches, single match, etc.)
- [ ] Fix any crashes or errors
- [ ] Verify all pages work

---

### **HOUR 19-21: Demo Preparation** 🎬
**Team:** Everyone

**Tasks:**
- [ ] Create demo script (what to show, what to say)
- [ ] Prepare 3-5 example exporters to demo
- [ ] Practice showing:
  - Data cleaning (show before/after)
  - Match generation (show scores)
  - Swipe interface (swipe right/left)
  - Weight adjustment (move sliders, show matches change)
  - Analytics dashboard
  - Algorithm explanation
  - Outreach panel
- [ ] Record backup screen capture (in case demo fails)

---

### **HOUR 21-23: Final Polish** ✨
**Team:** Everyone

**Tasks:**
- [ ] Add helpful error messages
- [ ] Improve explanations
- [ ] Add tooltips/help text
- [ ] Verify all features work end-to-end
- [ ] Check code comments
- [ ] Prepare presentation slides (if needed)

---

### **HOUR 23-24: Presentation Prep** 🎤
**Team:** Everyone

**Tasks:**
- [ ] Rehearse demo (5-10 minutes)
- [ ] Prepare talking points:
  - Problem statement
  - Your solution approach
  - Key innovations
  - Technical highlights
  - Impact/benefits
- [ ] Prepare for Q&A:
  - How does scoring work?
  - How does real-time adaptability work?
  - What makes your solution unique?
- [ ] Test app one final time
- [ ] Get good sleep! 😴

---

## 🎯 Key Success Factors

### What Judges Will Look For:
1. ✅ **Working Prototype** - App runs without crashes
2. ✅ **Data Intelligence** - Shows you cleaned and processed data intelligently
3. ✅ **Explainable Scoring** - Can explain WHY each match was suggested
4. ✅ **Real-Time Adaptability** - Demonstrate weight adjustment live
5. ✅ **User Experience** - Swipe interface is intuitive
6. ✅ **Innovation** - Your unique approach (graph-based, behavioral encoding)

### Demo Flow (5-10 minutes):
1. **Introduction** (30s): "We built ForeTrade, an intelligent matchmaking system..."
2. **Show Problem** (30s): "Traditional platforms use keyword search, we use behavioral modeling..."
3. **Live Demo** (4-5 min):
   - Select exporter
   - Show matches appear
   - Swipe right on one (explain why)
   - Swipe left on one (explain why)
   - Adjust weight sliders → show matches change
   - Show Analytics page
   - Show Algorithm workflow
   - Show Outreach panel
4. **Technical Highlights** (2 min):
   - Data cleaning pipeline
   - Graph-based affinity
   - Multi-signal scoring
   - Adaptive learning
5. **Impact** (1 min): "Reduces irrelevant outreach by 25-35%, faster buyer discovery..."

---

## 🚨 Common Pitfalls to Avoid

1. ❌ **Don't overcomplicate** - Simple working solution > complex broken solution
2. ❌ **Don't skip testing** - Test each module as you build it
3. ❌ **Don't ignore edge cases** - Handle empty matches, missing data gracefully
4. ❌ **Don't forget explainability** - Every match needs a reason
5. ❌ **Don't skip the demo prep** - Practice makes perfect

---

## 📁 File Implementation Priority

**MUST HAVE (Core Functionality):**
1. ✅ `engine/cleaner.py` - Data cleaning
2. ✅ `engine/features.py` - Feature engineering
3. ✅ `engine/graph.py` - Graph affinity
4. ✅ `engine/scorer.py` - Match scoring
5. ✅ `engine/explainer.py` - Match explanations
6. ✅ `app.py` - Main app integration
7. ✅ `ui/swipe.py` - Swipe interface

**SHOULD HAVE (Polish):**
8. ✅ `ui/dashboard.py` - Analytics & workflow
9. ✅ Styling & CSS

**NICE TO HAVE (Bonus):**
10. Graph visualization
11. Advanced analytics
12. Email integration

---

## 🆘 If You Get Stuck

1. **Simplify** - Replace complex logic with hardcoded values temporarily
2. **Skip** - Move to next module, come back later
3. **Ask** - Use AI tools, Stack Overflow, documentation
4. **Test** - Print intermediate values, verify data shapes
5. **Focus** - Core functionality first, polish later

---

## ✅ Pre-Hackathon Checklist

- [ ] Environment set up
- [ ] Dependencies installed
- [ ] Synthetic data generated
- [ ] Basic app runs
- [ ] Team understands the plan
- [ ] Each person knows their role
- [ ] Backup plan ready (simplified version)

---

## 🎉 You've Got This!

Remember:
- **Working > Perfect** - Get it working first, then improve
- **Demo > Code** - Judges see the demo, not the code
- **Explain > Impress** - Clear explanations win
- **Teamwork > Solo** - Divide and conquer

**Good luck! You're going to crush it! 🚀**
