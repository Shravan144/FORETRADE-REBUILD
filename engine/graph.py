"""
=============================================================================
GRAPH-BASED AFFINITY — ForeTrade
=============================================================================
Uses NetworkX to model the trade network and compute structural similarity
between exporters and buyers.

WHY GRAPH MATTERS (for judges):
    - Trade relationships form a network
    - Buyers who share suppliers are likely to have similar needs
    - Exporters who serve similar regions may be interchangeable
    - Graph provides "collaborative filtering" for trade

ARCHITECTURE:
    Transactions → build_trade_graph() → NetworkX Graph
                                           ↓
                   compute_graph_affinity(exporter, buyer) → affinity score

TODO CHECKLIST:
    [ ] HOUR 4-5: Implement build_trade_graph()
    [ ] HOUR 5:   Implement compute_graph_affinity()
    [ ] HOUR 6:   (Optional) Add graph visualization with Plotly
    [ ] HOUR 14:  (Optional) Add community detection for clusters
=============================================================================
"""

import networkx as nx
import pandas as pd
import numpy as np
from typing import Optional


def build_trade_graph(transactions: pd.DataFrame) -> nx.Graph:
    """
    Build a bipartite trade graph from transactions.
    
    Nodes:
        - Exporters (prefixed with "E" already, e.g., "E001")
        - Buyers (prefixed with "B" already, e.g., "B001")
    
    Edges:
        - Between exporter and buyer who have traded
        - Edge weight = total trade value between them
        - Edge attribute: num_transactions, avg_value, last_trade_date
    """
    G = nx.Graph()
    
    # Group transactions by exporter-buyer pairs
    for (exp_id, buy_id), group in transactions.groupby(["exporter_id", "buyer_id"]):
        G.add_edge(
            exp_id, 
            buy_id,
            weight=group["trade_value"].sum(),
            num_trades=len(group),
            avg_value=group["trade_value"].mean(),
        )
    
    # Add node attributes
    for node in G.nodes():
        G.nodes[node]["type"] = "exporter" if str(node).startswith("E") else "buyer"
    
    return G


def compute_graph_affinity(
    G: nx.Graph, 
    exporter_id: str, 
    buyer_id: str
) -> float:
    """
    ⭐ Compute structural affinity between exporter and buyer.

    Methods (pick one or combine):
    
    1. Common Neighbors Score:
       How many shared connections do they have?
       More shared connections = higher affinity
       Score = |common_neighbors| / max_possible
    
    2. Jaccard Coefficient:
       |common_neighbors| / |all_neighbors_union|
       Built into NetworkX: nx.jaccard_coefficient(G, [(exp, buy)])
    
    3. Adamic-Adar Index (fancy — brownie points):
       Weights common neighbors by how rare they are
       nx.adamic_adar_index(G, [(exp, buy)])
    
    4. Shortest Path Score:
       Shorter path = more related
       score = 1 / (1 + shortest_path_length)
    """
    # Edge case: nodes not in graph
    if exporter_id not in G or buyer_id not in G:
        return 0.0
    
    # If they already trade directly, high affinity
    if G.has_edge(exporter_id, buyer_id):
        return 0.9
    
    # Use Jaccard coefficient (scaled up since values are typically small)
    try:
        preds = nx.jaccard_coefficient(G, [(exporter_id, buyer_id)])
        for u, v, score in preds:
            # Scale up: Jaccard is usually 0-0.1, we want 0-1
            return min(score * 10, 1.0)
    except:
        pass
    
    # Fallback: shortest path score
    try:
        if nx.has_path(G, exporter_id, buyer_id):
            path_length = nx.shortest_path_length(G, exporter_id, buyer_id)
            return 1.0 / (1.0 + path_length)
    except:
        pass
    
    return 0.0


def get_graph_stats(G: nx.Graph) -> dict:
    """
    Get summary statistics about the trade graph.
    Useful for the dashboard.
    
    Returns:
        Dict with graph statistics
    
    TODO (HOUR 14): Implement for dashboard display
    """
    return {
        "num_nodes":      G.number_of_nodes(),
        "num_edges":      G.number_of_edges(),
        "num_exporters":  sum(1 for n in G.nodes() if str(n).startswith("E")),
        "num_buyers":     sum(1 for n in G.nodes() if str(n).startswith("B")),
        "density":        nx.density(G) if G.number_of_nodes() > 0 else 0,
        "avg_degree":     (sum(dict(G.degree()).values()) / G.number_of_nodes() 
                           if G.number_of_nodes() > 0 else 0),
    }


def visualize_graph_plotly(
    G: nx.Graph, 
    highlight_exporter: Optional[str] = None,
    highlight_buyer: Optional[str] = None
):
    """
    Create a Plotly figure of the trade graph.
    
    Features:
        - Exporter nodes in blue, buyer nodes in green
        - Highlighted exporter/buyer in red/orange
        - Edge thickness = trade volume
    
    Returns:
        Plotly figure object (display in Streamlit with st.plotly_chart)
    
    TODO (HOUR 14-15): Implement for the dashboard
    
    HINT:
        - Use nx.spring_layout(G) for positions
        - Create Plotly scatter + line traces
        - See: https://plotly.com/python/network-graphs/
    """
    # TODO: Implement graph visualization
    # This is a polish feature, skip if running low on time.
    pass
