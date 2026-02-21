"""
Warmup script: pre-train and cache ALL ML models for instant Streamlit restarts.
Run once: python _benchmark.py
"""
import sys, os, time, warnings
sys.path.insert(0, os.path.dirname(__file__))
warnings.filterwarnings("ignore")

import pandas as pd
from engine.cleaner import clean_transactions, clean_exporters, clean_buyers, detect_high_intent_buyers
from engine.features import build_exporter_profiles, build_buyer_profiles
from engine.graph import build_trade_graph
from engine.ml_models import train_buyer_segments, train_match_predictor
from engine.ltr_ranker import train_ltr_ranker
from engine.graph_embeddings import train_graph_embeddings
from engine.nlp_engine import initialize_nlp
from engine.model_cache import cache_exists, load_cache, save_cache

DATA_DIR = "data"

# ── Load & clean data ─────────────────────────────────────────────────
print("Loading data...")
exporters = pd.read_csv(os.path.join(DATA_DIR, "exporters.csv"))
buyers = pd.read_csv(os.path.join(DATA_DIR, "buyers.csv"))
transactions = pd.read_csv(os.path.join(DATA_DIR, "transactions.csv"))

if len(transactions) > 20_000:
    transactions = transactions.sample(n=20_000, random_state=42).reset_index(drop=True)

transactions = clean_transactions(transactions)
exporters = clean_exporters(exporters)
buyers = clean_buyers(buyers)
buyers = detect_high_intent_buyers(buyers, transactions)

exp_prof = build_exporter_profiles(exporters, transactions)
buy_prof = build_buyer_profiles(buyers, transactions)
graph = build_trade_graph(transactions)

news_path = os.path.join(DATA_DIR, "global_news.csv")
news_df = pd.read_csv(news_path) if os.path.exists(news_path) else pd.DataFrame()

print(f"  {len(exporters)} exporters, {len(buyers)} buyers, {len(transactions)} txns")
print(f"  Graph: {graph.number_of_nodes()} nodes, {graph.number_of_edges()} edges")

total_t0 = time.time()

# ── 1. K-Means + GB+RF ───────────────────────────────────────────────
if cache_exists("ml_seg_gb"):
    print("\n[1/4] ml_seg_gb: CACHED (skip)")
else:
    t0 = time.time()
    seg_result = train_buyer_segments(buy_prof)
    gb_result = train_match_predictor(exp_prof, buy_prof, transactions, graph, news_df, sample_size=800)
    save_cache("ml_seg_gb", {"seg": seg_result, "gb": gb_result})
    print(f"\n[1/4] ml_seg_gb: trained in {time.time()-t0:.1f}s")

# ── 2. LTR LambdaRank ────────────────────────────────────────────────
if cache_exists("ml_ltr"):
    print("[2/4] ml_ltr: CACHED (skip)")
else:
    t0 = time.time()
    ltr_result = train_ltr_ranker(exp_prof, buy_prof, transactions, graph, news_df)
    save_cache("ml_ltr", ltr_result)
    print(f"[2/4] ml_ltr: trained in {time.time()-t0:.1f}s")

# ── 3. Graph Embeddings ──────────────────────────────────────────────
if cache_exists("ml_graph_emb"):
    print("[3/4] ml_graph_emb: CACHED (skip)")
else:
    t0 = time.time()
    ge_result = train_graph_embeddings(graph)
    save_cache("ml_graph_emb", ge_result)
    print(f"[3/4] ml_graph_emb: trained in {time.time()-t0:.1f}s")

# ── 4. NLP Pipeline ──────────────────────────────────────────────────
if cache_exists("ml_nlp"):
    print("[4/4] ml_nlp: CACHED (skip)")
else:
    t0 = time.time()
    nlp_result = initialize_nlp(news_df)
    save_cache("ml_nlp", nlp_result)
    print(f"[4/4] ml_nlp: trained in {time.time()-t0:.1f}s")

total_time = time.time() - total_t0

# ── Summary ───────────────────────────────────────────────────────────
print(f"\n{'='*50}")
print(f"All models cached in {total_time:.1f}s total")
cache_dir = os.path.join(DATA_DIR, "_model_cache")
for f in os.listdir(cache_dir):
    size = os.path.getsize(os.path.join(cache_dir, f)) / 1024
    print(f"  {f}: {size:.0f} KB")
print(f"\nNext Streamlit restart will load ALL from cache in ~1s.")
