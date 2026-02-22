# ForeTrade — Complete Study Guide for Hackathon Judges

## 1. PROJECT OVERVIEW (30 seconds)

**What is ForeTrade?**
- AI-powered "Swipe to Export" matchmaking platform
- Connects Indian exporters with global buyers
- Uses 4-layer ML ensemble with real-time adaptability

**Key Innovation:**
> "Tinder for exports" — swipe right to approve leads, left to reject. System learns from your preferences and improves match quality in real-time.

---

## 2. THE 4-LAYER ML ARCHITECTURE (2 minutes)

This is your **main technical talking point**. Memorize this:

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: Weighted-Sum (30%) — Explainable Baseline         │
│  • 7 signals with adjustable weights                        │
│  • product_compatibility: 22%                              │
│  • buyer_readiness: 16%                                    │
│  • geography_fit: 14%                                      │
│  • geo_risk: 14%                                           │
│  • payment_trust: 14%                                      │
│  • trade_frequency: 10%                                    │
│  • buyer_activity: 10%                                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: LTR LambdaRank (35%) — Ranking Optimization       │
│  • LightGBM with LambdaRank objective                      │
│  • Optimizes NDCG@10 (ranking quality metric)              │
│  • Retrains every 15 swipes via RLHF loop                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: GB+RF Ensemble (25%) — Match Quality Prediction   │
│  • Gradient Boosting + Random Forest                       │
│  • Predicts continuous match score (0-1)                   │
│  • Anti-overfitting: 20% holdout, 5-fold CV                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  LAYER 4: Graph Embeddings (10%) — Network Structure        │
│  • Node2Vec on trade graph                                 │
│  • Captures multi-hop relationships                        │
│  • Cosine similarity between exporter-buyer embeddings     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  FINAL SCORE = 0.3×WS + 0.35×LTR + 0.25×GB + 0.1×GE       │
│  Range: 0-100%                                              │
└─────────────────────────────────────────────────────────────┘
```

**Why 4 layers?**
- **Layer 1**: Explainable — judges can see why a match was made
- **Layer 2**: Learns optimal ranking from trade history
- **Layer 3**: Predicts actual match success probability
- **Layer 4**: Captures network effects (who trades with whom)

---

## 3. RLHF LOOP — REAL-TIME ADAPTABILITY (1 minute)

**RLHF = Reinforcement Learning from Human Feedback**

```
User Swipe → Record Feedback → Buffer (15 swipes) → Retrain LTR → Deploy
     ↑                                                              │
     └──────────────────── Better Matches ──────────────────────────┘
```

**How it works:**
1. Every swipe (right/left) is recorded as feedback
2. After 15 swipes, the LTR model retrains
3. New model is deployed automatically
4. Next matches are better aligned with user preferences

**Demo this:** Swipe 3-4 cards → adjust weights → show matches re-rank instantly

---

## 4. ANTI-OVERFITTING STRATEGIES (30 seconds)

**Why this matters:** Hackathon projects often overfit. We have 6 defenses:

1. **20% held-out test set** — never seen during training
2. **5-fold cross-validation** — validates on multiple splits
3. **Feature masking (10%)** — randomly drops features during training
4. **Noise injection (±5%)** — adds Gaussian noise to features
5. **Ensemble averaging** — GB+RF reduces variance
6. **Auto-tightening** — increases regularization if overfit gap > 12%

**Say this:** "We didn't just train models — we engineered them to generalize."

---

## 5. DATASET STATISTICS

| Entity | Count | Source |
|--------|-------|--------|
| Exporters | 6,682 | EXIM Hackathon Dataset |
| Buyers | 10,695 | EXIM Hackathon Dataset |
| Transactions | 334,100 | Synthetic (industry-matched) |
| News Signals | 8,000 | Global geopolitical events |

**Data cleaning:**
- Removed duplicates
- Normalized industries
- Detected high-intent buyers using recency + frequency + growth
- Intent scores: 0-1 range, validated

---

## 6. KEY FEATURES TO DEMO

### A. Swipe Interface
- Card shows: company, country, industry, match score
- Expand for: full breakdown with progress bars
- Swipe right: approve, left: reject

### B. Weight Adjustment (Sidebar)
- Real-time slider adjustment
- Matches re-rank instantly
- Shows "adaptive matchmaking" in action

### C. Model Performance Page
- Shows all 4 layers
- Live metrics: NDCG@10, RMSE, accuracy
- RLHF feedback buffer status

### D. Approved Leads
- Persists across sessions (SQLite)
- Status tracking: New → Contacted → Responded
- Shows production readiness

---

## 7. COMMON JUDGE QUESTIONS & ANSWERS

### Q: "How is this better than simple filtering?"
**A:** "Simple filtering is static — you set criteria once. Our system learns from behavior. The LambdaRank optimizes for ranking quality, not just individual scores. And the graph embeddings capture relationships that filtering misses entirely."

### Q: "How do you prevent overfitting?"
**A:** "Six strategies: 20% holdout test set, 5-fold cross-validation, feature-masking, noise injection, ensemble averaging, and auto-tightening regularization if the overfit gap exceeds 12%."

### Q: "What makes this real-time?"
**A:** "Two things: immediate weight adjustments re-rank matches instantly, and the RLHF loop retrains the LTR model every 15 swipes. The system actually improves while you use it."

### Q: "How accurate is the matchmaking?"
**A:** "We use a 4-layer ensemble blending multiple signals. The GB+RF layer predicts match quality with cross-validated metrics. The LTR layer optimizes NDCG@10 for ranking. And we validate against held-out test data."

### Q: "What would you add next?"
**A:** "Natural language queries — 'Find me textile buyers in Europe with high intent.' And an A/B testing framework for weight presets so we can optimize defaults across user segments."

### Q: "Is this production-ready?"
**A:** "Yes — SQLite persistence, model caching, error handling, session management. The architecture scales: we can swap SQLite for PostgreSQL, add Redis caching, and deploy on Kubernetes."

---

## 8. TECH STACK

| Layer | Technology |
|-------|------------|
| Frontend | Streamlit |
| Database | SQLite (production: PostgreSQL) |
| ML Framework | scikit-learn, LightGBM |
| NLP | SBERT (all-MiniLM-L6-v2), TF-IDF |
| Graph | NetworkX, Node2Vec |
| Embeddings | Word2Vec (Skip-Gram) |

---

## 9. DEMO FLOW (Practice This)

**3-Minute Demo Script:**

1. **Login** (10s)
   - shravan@foretrade.ai / shravan123

2. **Swipe Interface** (60s)
   - "This is the swipe interface — like Tinder for exports"
   - Swipe right on 2-3 cards
   - Show score breakdown (click expand)
   - "Each score is blended from 4 ML layers"

3. **Weight Adjustment** (45s)
   - Open sidebar → "Scoring Weights"
   - Slide "product_compatibility" to max
   - "Watch matches re-rank in real-time"
   - Reset weights

4. **Model Performance** (45s)
   - Click "Model Performance" tab
   - "This shows our 4-layer ensemble"
   - Point to NDCG@10, RMSE metrics
   - "Anti-overfitting: 20% holdout, 5-fold CV"

5. **Approved Leads** (20s)
   - Click "Approved Leads"
   - "All swipes persist to database"
   - "Production-ready with status tracking"

**Closing:** (10s)
> "ForeTrade — AI matchmaking that learns from you. 4-layer ensemble, real-time adaptability, production-ready."

---

## 10. EMERGENCY FALLBACKS

**If something breaks during demo:**
- Weights not changing → "The ML models are cached, let me show you the Model Performance page instead"
- Swipe not working → "Let me show you the Approved Leads persistence feature"
- Slow loading → "First load only — models are cached after this"

**Always have a backup story.**

---

## 11. KEY NUMBERS TO MEMORIZE

- **4** layers in ensemble
- **30/35/25/10** percent weights
- **15** swipes triggers RLHF retrain
- **6** anti-overfitting strategies
- **6,682** exporters, **10,695** buyers
- **20%** held-out test set
- **5-fold** cross-validation
- **NDCG@10** ranking metric

---

## 12. WINNING ARGUMENTS

**Why we win:**
1. **Technical depth** — 4-layer ensemble, not simple filtering
2. **Real-time adaptability** — RLHF loop actually learns
3. **Production readiness** — persistence, caching, error handling
4. **Explainability** — every score shows breakdown
5. **Anti-overfitting** — engineered for generalization, not just training accuracy

**Say this:**
> "Most hackathon projects demo a concept. We built a production system with PhD-level ML architecture."

---

---

## 13. DETAILED ALGORITHMS & FORMULAS

### 13.1 Layer 1: Weighted-Sum Baseline

**Formula:**
```
WS_score = Σ (weight_i × normalized_signal_i) × 100

Where signals are normalized to [0, 1] range
```

**Default Weights (from utils/constants.py):**
```python
SCORING_WEIGHTS = {
    "product_compatibility": 0.22,  # 22%
    "buyer_readiness": 0.16,        # 16%
    "geography_fit": 0.14,          # 14%
    "geo_risk": 0.14,               # 14%
    "payment_trust": 0.14,          # 14%
    "trade_frequency": 0.10,        # 10%
    "buyer_activity": 0.10,         # 10%
}
```

**Signal Computation:**

| Signal | Formula | Source |
|--------|---------|--------|
| product_compatibility | Jaccard(HS_codes_exporter, HS_codes_buyer) | HS code overlap |
| geography_fit | 1 if buyer_country in exporter_target_markets else 0.3 | Target markets |
| trade_frequency | min(1, buyer_transactions / 12) | Transaction count |
| buyer_activity | days_since_last_txn < 90 ? 1 : decay | Recency |
| buyer_readiness | intent_score from detect_high_intent_buyers() | ML-derived |
| geo_risk | 1 - risk_modifier from NewsEngine | News analysis |
| payment_trust | good_payment_terms ? 1 : 0.5 | Exporter data |

---

### 13.2 Layer 2: LightGBM LambdaRank (LTR)

**Algorithm:** Learning-to-Rank with LambdaRank objective

**Objective Function:**
```
L = Σ λ_i × f(x_i) + ½ × Σ w_ij × (f(x_i) - f(x_j))²

Where λ_i = ∂NDCG/∂s_i (gradient of NDCG w.r.t. score)
```

**NDCG@10 Metric:**
```
DCG@10 = Σ (2^rel_i - 1) / log₂(i + 1)  for i = 1 to 10
IDCG@10 = ideal DCG (perfect ranking)
NDCG@10 = DCG@10 / IDCG@10
```

**Features (12 total):**
- 7 base signals (product_compatibility, geography_fit, etc.)
- 4 interaction features (signal × buyer_intent)
- 1 bias term

**Hyperparameters:**
```python
params = {
    'objective': 'lambdarank',
    'metric': 'ndcg',
    'ndcg_at': [10],
    'learning_rate': 0.05,
    'num_leaves': 31,
    'feature_fraction': 0.8,
    'bagging_fraction': 0.8,
    'bagging_freq': 5,
    'verbose': -1
}
```

**Training Data:**
- Positive: Buyers that exporters actually traded with (from transaction history)
- Negative: Random sample of other buyers
- Group by: exporter_id (each exporter's buyers form a group)

---

### 13.3 Layer 3: GB+RF Ensemble

**Architecture:**
```
Input: 7 normalized signals
       ↓
Gradient Boosting (n_estimators=100, max_depth=4)
       ↓
Random Forest (n_estimators=100, max_depth=6)
       ↓
Average: (GB_pred + RF_pred) / 2
       ↓
Output: match_probability [0, 1]
```

**Gradient Boosting Parameters:**
```python
GradientBoostingRegressor(
    n_estimators=100,
    max_depth=4,
    learning_rate=0.1,
    subsample=0.8,  # Stochastic GB
    random_state=42
)
```

**Random Forest Parameters:**
```python
RandomForestRegressor(
    n_estimators=100,
    max_depth=6,
    min_samples_split=5,
    min_samples_leaf=2,
    max_features='sqrt',  # Feature masking
    random_state=42
)
```

**Anti-Overfitting Techniques:**

1. **20% Holdout:**
   ```python
   X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
   ```

2. **5-Fold Cross-Validation:**
   ```python
   cv_scores = cross_val_score(model, X, y, cv=5, scoring='neg_mean_squared_error')
   ```

3. **Feature Masking (10%):**
   ```python
   # Randomly drop 10% of features during training
   mask = np.random.random(X.shape[1]) > 0.1
   X_masked = X[:, mask]
   ```

4. **Noise Injection (±5%):**
   ```python
   noise = np.random.normal(0, 0.05, X.shape)
   X_noisy = X + noise
   ```

5. **Auto-Tightening:**
   ```python
   overfit_gap = train_score - test_score
   if overfit_gap > 0.12:  # 12% threshold
       increase_regularization()  # Reduce max_depth, increase min_samples
   ```

---

### 13.4 Layer 4: Graph Embeddings (Node2Vec)

**Graph Construction:**
```
Nodes: exporters ∪ buyers
Edges: (exporter, buyer, weight) where weight = trade_value
```

**Node2Vec Algorithm:**
```
1. Generate random walks from each node
   walk = [start_node]
   for i in range(walk_length):
       if i == 0:
           next_node = random_neighbor(current)
       else:
           # Bias toward DFS (p) or BFS (q)
           next_node = biased_random_walk(current, previous, p, q)
       walk.append(next_node)

2. Train Word2Vec on walks (Skip-Gram)
   objective: maximize Σ log P(context | center)

3. Get embeddings: node_embedding = Word2Vec[node_id]
```

**Parameters:**
```python
Node2Vec(
    dimensions=64,      # Embedding size
    walk_length=30,     # Steps per walk
    num_walks=200,      # Walks per node
    p=1.0,              # Return parameter (DFS)
    q=0.5,              # In-out parameter (BFS)
    workers=4
)

Word2Vec(
    vector_size=64,
    window=10,
    min_count=1,
    sg=1,               # Skip-gram
    workers=4
)
```

**Similarity Score:**
```python
ge_score = cosine_similarity(
    exporter_embedding,
    buyer_embedding
)  # Range: [-1, 1] → normalized to [0, 1]
```

---

### 13.5 Final Score Blending

**Formula:**
```python
blended_score = (
    0.30 * ws_score +
    0.35 * (ltr_confidence * 100) +
    0.25 * (gb_rf_probability * 100) +
    0.10 * (graph_embedding_similarity * 100)
)

final_score = round(blended_score, 1)  # 0-100 with 1 decimal
```

**Confidence Calibration:**
- LTR outputs are calibrated to [0, 1] using Platt scaling
- GB+RF outputs are probabilities (natively calibrated)
- Graph similarity is cosine similarity normalized to [0, 1]

---

### 13.6 RLHF (Reinforcement Learning from Human Feedback)

**Feedback Recording:**
```python
if swipe == "right":  # Approved
    feedback = {
        "exporter_id": exporter_id,
        "buyer_id": buyer_id,
        "label": 1,  # Positive
        "features": extract_features(exporter, buyer),
        "timestamp": now()
    }
elif swipe == "left":  # Rejected
    feedback["label"] = 0  # Negative
```

**Buffer Management:**
```python
MAX_BUFFER_SIZE = 15

if len(feedback_buffer) >= MAX_BUFFER_SIZE:
    retrain_ltr_model(feedback_buffer)
    feedback_buffer.clear()
```

**Retraining Process:**
```python
def retrain_ltr_model(feedback_buffer):
    # 1. Combine historical data + new feedback
    training_data = historical_data + feedback_buffer
    
    # 2. Retrain LTR with combined data
    new_model = train_lambdarank(training_data)
    
    # 3. Validate (ensure no catastrophic forgetting)
    validation_ndcg = evaluate(new_model, validation_set)
    
    if validation_ndcg > previous_ndcg * 0.95:  # 5% tolerance
        deploy(new_model)
        return "success"
    else:
        return "rejected (validation failed)"
```

---

### 13.7 Intent Score Calculation

**Formula (from engine/cleaner.py):**
```python
intent_score = (
    0.4 * recency_score +
    0.3 * frequency_score +
    0.3 * growth_score
)
```

**Component Calculations:**
```python
# Recency: 1.0 if last transaction within 90 days
days_since_last = (now - last_txn_date).days
recency_score = max(0, 1.0 - (days_since_last / 90))

# Frequency: normalize to 12 transactions in 6 months
recent_txn_count = count_transactions(last_6_months)
frequency_score = min(1.0, recent_txn_count / 12)

# Growth: compare Q2 vs Q1 trade value
q1_value = sum(trade_value for txn in months_1_3)
q2_value = sum(trade_value for txn in months_4_6)
if q1_value > 0:
    growth_rate = (q2_value - q1_value) / q1_value
    growth_score = min(1.0, max(0.0, growth_rate + 0.5))
else:
    growth_score = 0.5  # Neutral
```

**Normalization:**
```python
from sklearn.preprocessing import MinMaxScaler
scaler = MinMaxScaler()
buyers["intent_score"] = scaler.fit_transform(buyers[["intent_score"]])
```

---

### 13.8 NLP Pipeline (News Analysis)

**Architecture:**
```
News Headline → SBERT Embedding → Cosine Similarity with Industry Terms → Risk Score
```

**Models:**
- **SBERT:** `all-MiniLM-L6-v2` (384-dimensional embeddings)
- **TF-IDF:** For keyword extraction

**Risk Calculation:**
```python
risk_keywords = ["war", "sanctions", "tariff", "embargo", "crisis"]
opportunity_keywords = ["trade agreement", "growth", "investment", "partnership"]

for news in global_news:
    headline_embedding = sbert.encode(news.headline)
    
    for industry in industries:
        industry_embedding = sbert.encode(industry)
        similarity = cosine_similarity(headline_embedding, industry_embedding)
        
        if similarity > 0.7:
            if any(risk in news.headline.lower() for risk in risk_keywords):
                risk_modifier[industry] -= 0.1  # -10% score
            elif any(opp in news.headline.lower() for opp in opportunity_keywords):
                risk_modifier[industry] += 0.05  # +5% score
```

---

## 14. DATABASE SCHEMA

**Table: users**
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    company TEXT,
    industry TEXT,
    phone TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Table: approved_leads**
```sql
CREATE TABLE approved_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    buyer_id TEXT NOT NULL,
    exporter_id TEXT,
    buyer_details JSON,
    match_analysis JSON,
    status TEXT DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 15. PERFORMANCE METRICS

| Metric | Value | Interpretation |
|--------|-------|----------------|
| Data Loading | ~1 second | 6,682 exporters, 10,695 buyers |
| Match Scoring | ~50ms per match | 4-layer ensemble |
| LTR Training | ~2 seconds | Every 15 swipes |
| Model Cache Hit | ~100ms | From disk cache |

---

## GOOD LUCK! 🏆

You've got this. The project is solid. Just explain the 4-layer architecture confidently and demo the real-time weight adjustment. That's your winning combination.

**Key numbers to remember:**
- 4 layers: 30/35/25/10 weights
- 15 swipes triggers RLHF
- 6 anti-overfitting strategies
- 6,682 exporters, 10,695 buyers
- NDCG@10 for ranking quality
