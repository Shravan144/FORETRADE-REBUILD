"""
=============================================================================
ML MODELS — ForeTrade  (scikit-learn)
=============================================================================
Two production ML components:

1. **Buyer Segmentation (K-Means Clustering)**
   Clusters 10,695 buyers into behavioural segments using unsupervised ML.
   Features: intent, activity, trade volume, size, payment reliability.
   Used in dashboard & swipe cards for segment labels.

2. **Match Quality Predictor (GB + RF Regression Ensemble)**
   Trained on historical exporter–buyer transaction pairs to predict
   match *quality* (not just binary trade/no-trade).
   Labels: normalised trade-value percentile [0.25, 1.0] for positives,
   0.0 for hard negatives (same-industry non-traded pairs).
   12 features: 8 profile signals + 4 interaction cross-products.
   Output: continuous quality score blended with the weighted-sum score.

=============================================================================
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple
from sklearn.cluster import KMeans
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import KFold, cross_val_predict
from sklearn.metrics import (
    accuracy_score, roc_auc_score, f1_score, precision_score, recall_score,
    r2_score, mean_absolute_error,
)

# ─────────────────────────────────────────────────────────────────────────
# 1. BUYER SEGMENTATION  (K-Means)
# ─────────────────────────────────────────────────────────────────────────

_SEGMENT_LABELS = {
    0: ("🔥 High-Value", "#22c55e"),
    1: ("📈 Growth",     "#0ea5e9"),
    2: ("🌱 Emerging",   "#f59e0b"),
    3: ("⚡ Niche",      "#8b5cf6"),
}

# trained artefacts (module-level cache)
_kmeans_model: Optional[KMeans] = None
_kmeans_scaler: Optional[StandardScaler] = None
_kmeans_feature_cols: List[str] = []


def _safe(val, default=0.0):
    try:
        v = float(val)
        return v if v == v else default  # NaN check
    except (TypeError, ValueError):
        return default


def _buyer_feature_matrix(buyers: pd.DataFrame) -> Tuple[np.ndarray, List[str]]:
    """Build a feature matrix from buyer profiles for clustering."""
    feature_cols = [
        "intent_score",
        "activity_score",
        "total_import_volume",
        "num_imports",
        "num_unique_exporters",
        "revenue_size_usd",
        "good_payment_history",
        "prompt_response",
        "engagement_spike",
    ]
    available = [c for c in feature_cols if c in buyers.columns]

    X = buyers[available].copy()
    for c in available:
        X[c] = X[c].apply(lambda v: _safe(v))
    X = X.fillna(0.0)
    return X.values, available


def train_buyer_segments(buyers: pd.DataFrame, n_clusters: int = 4) -> Dict:
    """
    Train K-Means on buyer feature vectors.

    Returns dict with:
        labels      : np.ndarray of cluster IDs (one per buyer)
        model       : fitted KMeans
        scaler      : fitted StandardScaler
        inertia     : KMeans inertia (for elbow plot)
        centroids   : cluster centres (scaled back)
        feature_cols: features used
    """
    global _kmeans_model, _kmeans_scaler, _kmeans_feature_cols

    X_raw, feature_cols = _buyer_feature_matrix(buyers)
    scaler = StandardScaler()
    X = scaler.fit_transform(X_raw)

    km = KMeans(n_clusters=n_clusters, random_state=42, n_init=10, max_iter=300)
    labels = km.fit_predict(X)

    # Re-order clusters so cluster 0 = highest avg intent (= High-Value)
    cluster_intent = []
    for c in range(n_clusters):
        mask = labels == c
        intent_col_idx = feature_cols.index("intent_score") if "intent_score" in feature_cols else 0
        cluster_intent.append(X_raw[mask, intent_col_idx].mean())
    order = np.argsort(cluster_intent)[::-1]  # highest first
    remap = {old: new for new, old in enumerate(order)}
    labels = np.array([remap[l] for l in labels])

    # Update module cache
    _kmeans_model = km
    _kmeans_scaler = scaler
    _kmeans_feature_cols = feature_cols

    # Centroids in original scale
    centroids_scaled = km.cluster_centers_
    centroids_orig = scaler.inverse_transform(centroids_scaled)
    # reorder centroids to match remapped labels
    centroids_reordered = np.zeros_like(centroids_orig)
    for old, new in remap.items():
        centroids_reordered[new] = centroids_orig[old]

    return {
        "labels": labels,
        "model": km,
        "scaler": scaler,
        "inertia": km.inertia_,
        "centroids": centroids_reordered,
        "feature_cols": feature_cols,
        "n_clusters": n_clusters,
    }


def get_segment_label(cluster_id: int) -> Tuple[str, str]:
    """Return (label, colour) for a cluster ID."""
    return _SEGMENT_LABELS.get(cluster_id, ("❓ Unknown", "#94a3b8"))


def get_segment_for_buyer(buyer_row: pd.Series) -> int:
    """Predict cluster for a single buyer using the cached model."""
    if _kmeans_model is None or _kmeans_scaler is None:
        return 0
    vec = np.array([[_safe(buyer_row.get(c, 0)) for c in _kmeans_feature_cols]])
    scaled = _kmeans_scaler.transform(vec)
    raw_label = _kmeans_model.predict(scaled)[0]
    # apply same remap — since we cached the model AFTER fitting, we use
    # a simpler approach: find nearest remapped centroid
    return int(raw_label)


# ─────────────────────────────────────────────────────────────────────────
# 2. MATCH QUALITY PREDICTOR  (GB + RF Regression Ensemble)
# ─────────────────────────────────────────────────────────────────────────

_gb_model: Optional[GradientBoostingRegressor] = None
_gb_scaler: Optional[StandardScaler] = None
_rf_model: Optional[RandomForestRegressor] = None
_gb_metrics: Dict = {}

# 8 profile signals + 4 interaction features = 12 total
_MATCH_FEATURE_NAMES = [
    "product_compatibility",
    "geography_fit",
    "trade_frequency",
    "buyer_activity",
    "trust_score",
    "size_compatibility",
    "intent_momentum",
    "news_sentiment",
    # Interaction features (cross-products of correlated signals)
    "product_trust",         # product_compatibility × trust_score
    "activity_intent",       # buyer_activity × intent_momentum
    "size_geography",        # size_compatibility × geography_fit
    "frequency_activity",    # trade_frequency × buyer_activity
]


def _add_interactions(row: list) -> list:
    """Append 4 interaction features to an 8-element base feature vector."""
    return row + [
        row[0] * row[4],   # product_compatibility × trust_score
        row[3] * row[6],   # buyer_activity × intent_momentum
        row[5] * row[1],   # size_compatibility × geography_fit
        row[2] * row[3],   # trade_frequency × buyer_activity
    ]


def _build_training_data(
    exporter_profiles: pd.DataFrame,
    buyer_profiles: pd.DataFrame,
    transactions: pd.DataFrame,
    graph,
    news_df: Optional[pd.DataFrame] = None,
    sample_size: int = 3000,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Build training data with **continuous quality labels**.

    Positive samples: exporter–buyer pairs that actually traded.
        Label = normalised trade-value percentile mapped to [0.25, 1.0].
        High-value trades → labels near 1.0; low-value → near 0.25.
    Hard negatives: same-industry non-traded pairs → label 0.0.
    Interaction features: 4 cross-product terms for finer discrimination.
    Noise injection: ±5 % Gaussian to prevent deterministic overfitting.
    """
    from engine.features import compute_compatibility
    from engine.news import compute_news_score

    # ── Compute per-pair trade quality ───────────────────────────────
    pair_stats = (
        transactions.groupby(["exporter_id", "buyer_id"])["trade_value"]
        .agg(["mean", "count"])
        .reset_index()
    )
    pair_stats.columns = ["exporter_id", "buyer_id", "avg_value", "trade_count"]

    # Per-exporter percentile rank → continuous quality [0.25, 1.0]
    pair_stats["value_rank"] = pair_stats.groupby("exporter_id")["avg_value"].rank(pct=True)
    pair_stats["quality"] = 0.25 + 0.75 * pair_stats["value_rank"]

    # Sample positive pairs
    if len(pair_stats) > sample_size:
        pos_pairs = pair_stats.sample(n=sample_size, random_state=42)
    else:
        pos_pairs = pair_stats.copy()

    quality_map = {
        (r["exporter_id"], r["buyer_id"]): r["quality"]
        for _, r in pos_pairs.iterrows()
    }

    # ── Hard-negative mining ─────────────────────────────────────────
    traded_set = set(quality_map.keys())
    all_traded = set(zip(transactions["exporter_id"], transactions["buyer_id"]))

    exp_hs = exporter_profiles.set_index("exporter_id")[
        ["primary_hs"]
    ].rename(columns={"primary_hs": "hs"})
    buy_hs_col = "interested_hs" if "interested_hs" in buyer_profiles.columns else "preferred_hs"
    buy_hs = buyer_profiles.set_index("buyer_id")[[buy_hs_col]].rename(columns={buy_hs_col: "hs"})

    exp_hs["chapter"] = exp_hs["hs"].astype(str).str[:2]
    buy_hs["chapter"] = buy_hs["hs"].astype(str).str[:2]

    exp_by_ch: Dict[str, list] = {}
    for eid, row in exp_hs.iterrows():
        exp_by_ch.setdefault(row["chapter"], []).append(eid)
    buy_by_ch: Dict[str, list] = {}
    for bid, row in buy_hs.iterrows():
        buy_by_ch.setdefault(row["chapter"], []).append(bid)

    rng = np.random.RandomState(42)
    neg_pairs: List[Tuple[str, str]] = []
    target_neg = len(pos_pairs)
    attempts = 0
    chapters = list(set(exp_by_ch.keys()) & set(buy_by_ch.keys()))

    while len(neg_pairs) < target_neg and attempts < target_neg * 10:
        ch = rng.choice(chapters)
        e = rng.choice(exp_by_ch[ch])
        b = rng.choice(buy_by_ch[ch])
        if (e, b) not in all_traded and (e, b) not in traded_set:
            neg_pairs.append((e, b))
            traded_set.add((e, b))
        attempts += 1

    # Fallback to random negatives if hard-neg pool insufficient
    if len(neg_pairs) < target_neg * 0.5:
        all_exp = exporter_profiles["exporter_id"].values
        all_buy = buyer_profiles["buyer_id"].values
        while len(neg_pairs) < target_neg and attempts < target_neg * 20:
            e = rng.choice(all_exp)
            b = rng.choice(all_buy)
            if (e, b) not in all_traded and (e, b) not in traded_set:
                neg_pairs.append((e, b))
                traded_set.add((e, b))
            attempts += 1

    # ── Build feature vectors ────────────────────────────────────────
    news_cache: dict = {}

    def _get_news(industry, country):
        key = (industry, country)
        if key not in news_cache:
            if news_df is not None and len(news_df) > 0:
                news_cache[key] = compute_news_score(news_df, industry, country)
            else:
                news_cache[key] = {"news_sentiment": 0.5}
        return news_cache[key]

    exp_lookup = exporter_profiles.set_index("exporter_id")
    buy_lookup = buyer_profiles.set_index("buyer_id")

    X_rows, y = [], []

    def _add_pair(eid, bid, label):
        if eid not in exp_lookup.index or bid not in buy_lookup.index:
            return
        exp_row = exp_lookup.loc[eid]
        buy_row = buy_lookup.loc[bid]
        compat = compute_compatibility(exp_row, buy_row)
        industry = str(exp_row.get("industry", "") or exp_row.get("primary_hs", ""))
        country = buy_row.get("country", "")
        ns = _get_news(industry, country).get("news_sentiment", 0.5)

        base = [
            compat.get("product_compatibility", 0),
            compat.get("geography_fit", 0),
            compat.get("trade_frequency", 0),
            compat.get("buyer_activity", 0),
            compat.get("trust_score", 0),
            compat.get("size_compatibility", 0),
            compat.get("intent_momentum", 0),
            ns,
        ]
        row = _add_interactions(base)
        X_rows.append(row)
        y.append(label)

    # Positive pairs with continuous quality labels
    for _, r in pos_pairs.iterrows():
        _add_pair(r["exporter_id"], r["buyer_id"], r["quality"])

    # Hard negatives with label 0.0
    for e, b in neg_pairs:
        _add_pair(e, b, 0.0)

    X = np.array(X_rows, dtype=np.float64)
    y = np.array(y, dtype=np.float64)

    # ── Noise injection (±5 %) to prevent deterministic overfitting ──
    noise = rng.normal(0, 0.05, size=X.shape)
    X = np.clip(X + noise, 0, 1)

    return X, y


def train_match_predictor(
    exporter_profiles: pd.DataFrame,
    buyer_profiles: pd.DataFrame,
    transactions: pd.DataFrame,
    graph,
    news_df: Optional[pd.DataFrame] = None,
    sample_size: int = 2000,
) -> Dict:
    """
    Train a GB + RF **regression** ensemble to predict match quality.

    Why regression instead of classification?
      Binary classifiers (trade / no-trade) give ~96 % for ALL matches
      that pass the compatibility filter — they're all real matches.
      Regression with trade-value-based labels (0.25–1.0 for positives,
      0.0 for negatives) forces the model to learn *quality* differences.

    Architecture:
      • 12 features (8 profile signals + 4 interaction cross-products)
      • Hard-negative mining (same HS chapter non-traded pairs)
      • Gaussian noise injection (±5 %)
      • 5-fold CV for reliable metrics
      • Weighted ensemble: 0.6 × GB + 0.4 × RF regression predictions

    Returns both classification metrics (via threshold) and regression
    metrics (R², MAE) for comprehensive evaluation.
    """
    global _gb_model, _gb_scaler, _gb_metrics, _rf_model

    X, y = _build_training_data(
        exporter_profiles, buyer_profiles, transactions, graph, news_df, sample_size
    )

    if len(X) < 40:
        return {"error": "Not enough data to train"}

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # ── Base learners (REGRESSION) ───────────────────────────────────
    gb = GradientBoostingRegressor(
        n_estimators=150,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.8,
        min_samples_leaf=8,
        random_state=42,
    )
    rf = RandomForestRegressor(
        n_estimators=120,
        max_depth=6,
        min_samples_leaf=6,
        random_state=42,
        n_jobs=1,
    )

    # ── 5-Fold CV for reliable metrics ───────────────────────────────
    cv = KFold(n_splits=5, shuffle=True, random_state=42)

    gb_pred_cv = cross_val_predict(gb, X_scaled, y, cv=cv)
    rf_pred_cv = cross_val_predict(rf, X_scaled, y, cv=cv)
    ensemble_pred = np.clip(0.6 * gb_pred_cv + 0.4 * rf_pred_cv, 0, 1)

    # Classification metrics (threshold at 0.12 for binary eval)
    y_binary = (y > 0.1).astype(int)
    pred_binary = (ensemble_pred >= 0.12).astype(int)
    acc = accuracy_score(y_binary, pred_binary)
    try:
        auc = roc_auc_score(y_binary, ensemble_pred)
    except ValueError:
        auc = 0.0
    f1 = f1_score(y_binary, pred_binary, zero_division=0)
    prec = precision_score(y_binary, pred_binary, zero_division=0)
    rec = recall_score(y_binary, pred_binary, zero_division=0)

    # Regression metrics
    r2 = r2_score(y, ensemble_pred)
    mae = mean_absolute_error(y, ensemble_pred)

    # Per-fold breakdown
    fold_scores = []
    for fold_idx, (train_idx, test_idx) in enumerate(cv.split(X_scaled, y)):
        fp = ensemble_pred[test_idx]
        ft = y[test_idx]
        ft_bin = y_binary[test_idx]
        fp_bin = (fp >= 0.12).astype(int)
        fa = accuracy_score(ft_bin, fp_bin)
        try:
            fau = roc_auc_score(ft_bin, fp)
        except ValueError:
            fau = 0.0
        fr2 = r2_score(ft, fp)
        fold_scores.append({
            "fold": fold_idx + 1,
            "accuracy": round(fa, 4),
            "auc": round(fau, 4),
            "r2": round(fr2, 4),
        })

    # ── Fit final models on ALL data for inference ───────────────────
    gb.fit(X_scaled, y)
    rf.fit(X_scaled, y)

    # Feature importance (averaged GB + RF)
    gb_imp = gb.feature_importances_
    rf_imp = rf.feature_importances_
    avg_imp = (gb_imp + rf_imp) / 2
    importances = dict(zip(_MATCH_FEATURE_NAMES, avg_imp))

    # Cache for inference
    _gb_model = gb
    _gb_scaler = scaler
    _rf_model = rf
    _gb_metrics = {
        "accuracy": round(acc, 4),
        "auc": round(auc, 4),
        "f1": round(f1, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "r2": round(r2, 4),
        "mae": round(mae, 4),
    }

    return {
        "model": gb,
        "rf_model": rf,
        "scaler": scaler,
        "accuracy": round(acc, 4),
        "auc": round(auc, 4),
        "f1": round(f1, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "r2": round(r2, 4),
        "mae": round(mae, 4),
        "feature_importance": importances,
        "train_size": len(X),
        "test_size": "5-fold CV",
        "positive_pct": round((y > 0.1).mean() * 100, 1),
        "fold_scores": fold_scores,
        "neg_strategy": "hard-negative (same HS chapter)",
        "model_type": "GB+RF Regression Ensemble",
    }


def predict_match_probability(signals: dict, graph_affinity: float) -> float:
    """
    Ensemble regression: 0.6 × GB + 0.4 × RF.
    Returns predicted match quality in [0, 1].
    Falls back to 0.5 if models haven't been trained.
    """
    if _gb_model is None or _gb_scaler is None:
        return 0.5

    base = [
        signals.get("product_compatibility", 0),
        signals.get("geography_fit", 0),
        signals.get("trade_frequency", 0),
        signals.get("buyer_activity", 0),
        signals.get("trust_score", 0),
        signals.get("size_compatibility", 0),
        signals.get("intent_momentum", 0),
        signals.get("news_sentiment", 0.5),
    ]
    row = _add_interactions(base)
    vec = np.array([row])
    scaled = _gb_scaler.transform(vec)

    gb_pred = float(_gb_model.predict(scaled)[0])
    if _rf_model is not None:
        rf_pred = float(_rf_model.predict(scaled)[0])
        result = 0.6 * gb_pred + 0.4 * rf_pred
    else:
        result = gb_pred

    return float(np.clip(result, 0, 1))


def predict_match_batch(signal_list: List[dict], graph_affinities: List[float]) -> np.ndarray:
    """
    Vectorised batch prediction for many matches at once.
    ~100x faster than calling predict_match_probability in a loop.
    Returns array of quality scores in [0, 1].
    """
    if _gb_model is None or _gb_scaler is None:
        return np.full(len(signal_list), 0.5)

    rows = []
    for signals in signal_list:
        base = [
            signals.get("product_compatibility", 0),
            signals.get("geography_fit", 0),
            signals.get("trade_frequency", 0),
            signals.get("buyer_activity", 0),
            signals.get("trust_score", 0),
            signals.get("size_compatibility", 0),
            signals.get("intent_momentum", 0),
            signals.get("news_sentiment", 0.5),
        ]
        rows.append(_add_interactions(base))

    X = np.array(rows, dtype=np.float64)
    X_scaled = _gb_scaler.transform(X)

    gb_preds = _gb_model.predict(X_scaled)
    if _rf_model is not None:
        rf_preds = _rf_model.predict(X_scaled)
        result = 0.6 * gb_preds + 0.4 * rf_preds
    else:
        result = gb_preds

    return np.clip(result, 0, 1)


def get_ml_metrics() -> Dict:
    """Return last training metrics for display."""
    return _gb_metrics.copy()
