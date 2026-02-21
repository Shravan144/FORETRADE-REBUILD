"""
=============================================================================
GRAPH EMBEDDINGS — ForeTrade  (Node2Vec-style)
=============================================================================
Learns dense vector representations of exporter/buyer nodes from the
trade network graph using random-walk-based embedding (Node2Vec).

Architecture:
  1. **Biased random walks** on the trade graph
     - p (return parameter) = 1.0  → balanced exploration
     - q (in-out parameter) = 0.5  → slightly favour BFS (industry clusters)
     - walk_length = 20, num_walks = 40 per node
  2. **Word2Vec (Skip-Gram)** trained on walk sequences
     - Treats node IDs like "words" and walk sequences like "sentences"
     - Learns 64-d embeddings that capture structural similarity
  3. **Embedding similarity** replaces the simple common-neighbors heuristic
     - cos(embed_exporter, embed_buyer) captures multi-hop relationships
     - Nodes that co-occur in random walks are similar even without direct edges

Why this matters:
  • Captures higher-order graph structure (2-hop, 3-hop relationships)
  • Provides dense features for the LTR model (replaces scalar graph_affinity)
  • Industry clusters emerge naturally from trade patterns
  • Collaborative filtering effect: "buyers of your competitors buy from you too"

=============================================================================
"""

import numpy as np
import networkx as nx
from typing import Dict, List, Optional, Tuple
import warnings

# ── Module-level cache ──────────────────────────────────────────────────
_embeddings: Optional[Dict[str, np.ndarray]] = None
_embedding_dim: int = 64
_stats: Dict = {}


def _biased_walk(G: nx.Graph, start, walk_length: int, p: float, q: float, rng) -> list:
    """
    Generate a single biased random walk from `start`.

    Parameters:
        p : return parameter (higher → less likely to revisit previous node)
        q : in-out parameter (lower → BFS-like, higher → DFS-like)
    """
    walk = [start]
    for _ in range(walk_length - 1):
        cur = walk[-1]
        neighbors = list(G.neighbors(cur))
        if not neighbors:
            break

        if len(walk) < 2:
            # First step: uniform random
            walk.append(neighbors[rng.randint(len(neighbors))])
            continue

        prev = walk[-2]
        # Compute unnormalised probabilities based on Node2Vec bias
        probs = []
        for nb in neighbors:
            weight = G[cur][nb].get("weight", 1.0)
            if nb == prev:
                probs.append(weight / p)   # return to previous
            elif G.has_edge(nb, prev):
                probs.append(weight)       # BFS (neighbour of previous)
            else:
                probs.append(weight / q)   # DFS (explore new territory)

        probs = np.array(probs, dtype=np.float64)
        probs /= probs.sum()
        idx = rng.choice(len(neighbors), p=probs)
        walk.append(neighbors[idx])

    return walk


def restore_from_cache(cached: Dict) -> None:
    """Restore module-level state from a cached result dict."""
    global _embeddings, _embedding_dim, _stats
    _embeddings = cached.get("_embeddings")
    _embedding_dim = cached.get("_embedding_dim", 64)
    _stats = {k: v for k, v in cached.items() if k not in ("_embeddings", "_embedding_dim")}


def train_graph_embeddings(
    G: nx.Graph,
    embedding_dim: int = 64,
    walk_length: int = 12,
    num_walks: int = 10,
    p: float = 1.0,
    q: float = 0.5,
    window: int = 5,
    min_count: int = 1,
    workers: int = 1,
) -> Dict:
    """
    Train Node2Vec-style graph embeddings.

    Pipeline:
      1. Generate biased random walks across the trade graph
      2. Train Word2Vec (Skip-Gram) on walk sequences
      3. Extract dense embeddings per node

    Returns dict with embeddings, stats, and metadata.
    """
    global _embeddings, _embedding_dim, _stats

    _embedding_dim = embedding_dim
    nodes = list(G.nodes())

    if len(nodes) < 10:
        _embeddings = {}
        _stats = {"error": "Graph too small for embedding"}
        return _stats

    rng = np.random.RandomState(42)

    # ── Generate random walks ────────────────────────────────────────
    walks = []
    for _ in range(num_walks):
        rng.shuffle(nodes)
        for node in nodes:
            walk = _biased_walk(G, node, walk_length, p, q, rng)
            walks.append([str(n) for n in walk])  # Word2Vec needs strings

    # ── Train Word2Vec (Skip-Gram) ───────────────────────────────────
    try:
        from gensim.models import Word2Vec

        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            w2v = Word2Vec(
                sentences=walks,
                vector_size=embedding_dim,
                window=window,
                min_count=min_count,
                sg=1,              # Skip-Gram
                workers=workers,
                epochs=5,
                seed=42,
            )

        _embeddings = {node: w2v.wv[str(node)] for node in nodes if str(node) in w2v.wv}

        _stats = {
            "n_nodes": len(nodes),
            "n_embedded": len(_embeddings),
            "embedding_dim": embedding_dim,
            "n_walks": len(walks),
            "walk_length": walk_length,
            "p": p,
            "q": q,
            "method": "Node2Vec + Word2Vec (Skip-Gram)",
        }

    except ImportError:
        # Fallback: spectral embedding via SVD on adjacency matrix
        _stats = _train_svd_fallback(G, nodes, embedding_dim)

    # Return cache-friendly result (includes embeddings for disk save)
    result = {**_stats, "_embeddings": _embeddings, "_embedding_dim": _embedding_dim}
    return result


def _train_svd_fallback(G: nx.Graph, nodes: list, dim: int) -> Dict:
    """
    Fallback: SVD-based spectral embedding of the adjacency matrix.
    Works with just numpy — no gensim needed.
    """
    global _embeddings

    adj = nx.to_numpy_array(G, nodelist=nodes)
    # Normalise by degree
    degrees = adj.sum(axis=1)
    D_inv_sqrt = np.diag(1.0 / np.sqrt(np.maximum(degrees, 1)))
    L_norm = D_inv_sqrt @ adj @ D_inv_sqrt

    # Truncated SVD
    k = min(dim, len(nodes) - 1)
    try:
        from numpy.linalg import svd
        U, S, _ = svd(L_norm, full_matrices=False)
        embeddings = U[:, :k] * np.sqrt(S[:k])
    except Exception:
        embeddings = np.random.randn(len(nodes), k) * 0.01

    _embeddings = {nodes[i]: embeddings[i] for i in range(len(nodes))}

    return {
        "n_nodes": len(nodes),
        "n_embedded": len(_embeddings),
        "embedding_dim": k,
        "method": "SVD Spectral Embedding (fallback)",
    }


# ─────────────────────────────────────────────────────────────────────────
# Inference
# ─────────────────────────────────────────────────────────────────────────
def get_node_embedding(node_id: str) -> Optional[np.ndarray]:
    """Get the embedding vector for a node. Returns None if not found."""
    if _embeddings is None:
        return None
    return _embeddings.get(node_id, None)


def compute_embedding_similarity(node_a: str, node_b: str) -> float:
    """
    Cosine similarity between two node embeddings.
    Returns 0.0 if either node has no embedding.
    """
    if _embeddings is None:
        return 0.0

    emb_a = _embeddings.get(node_a)
    emb_b = _embeddings.get(node_b)

    if emb_a is None or emb_b is None:
        return 0.0

    dot = np.dot(emb_a, emb_b)
    norm_a = np.linalg.norm(emb_a)
    norm_b = np.linalg.norm(emb_b)

    if norm_a < 1e-8 or norm_b < 1e-8:
        return 0.0

    sim = float(dot / (norm_a * norm_b))
    # Map from [-1, 1] to [0, 1]
    return max(0.0, min(1.0, (sim + 1.0) / 2.0))


def get_embedding_stats() -> Dict:
    """Return stats for the Model Performance page."""
    return _stats.copy()


def get_nearest_neighbors(node_id: str, top_k: int = 5) -> List[Tuple[str, float]]:
    """
    Find the top-K most similar nodes by embedding distance.
    Useful for "Similar buyers" / "Similar exporters" features.
    """
    if _embeddings is None or node_id not in _embeddings:
        return []

    target = _embeddings[node_id]
    sims = []
    for nid, emb in _embeddings.items():
        if nid == node_id:
            continue
        dot = np.dot(target, emb)
        norm_t = np.linalg.norm(target)
        norm_e = np.linalg.norm(emb)
        if norm_t > 1e-8 and norm_e > 1e-8:
            sim = float(dot / (norm_t * norm_e))
            sims.append((nid, sim))

    sims.sort(key=lambda x: x[1], reverse=True)
    return sims[:top_k]
