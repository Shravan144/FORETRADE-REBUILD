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
    [x] HOUR 4-5: Implement build_trade_graph()
    [x] HOUR 5:   Implement compute_graph_affinity()
    [x] HOUR 6:   Add graph visualization with Plotly
    [x] HOUR 14:  Add community detection for clusters
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
    
    # Common neighbors score (fast O(degree) — no expensive path search)
    common = len(list(nx.common_neighbors(G, exporter_id, buyer_id)))
    if common > 0:
        max_possible = min(G.degree(exporter_id), G.degree(buyer_id))
        return min(common / max(max_possible, 1) * 2, 1.0)
    
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
    Create a Plotly figure of the trade graph (sub-graph around the
    highlighted exporter/buyer for readability).

    Features:
        - Exporter nodes in blue, buyer nodes in green
        - Highlighted exporter/buyer in red/orange
        - Edge thickness = trade volume
    
    Returns:
        Plotly figure object (display in Streamlit with st.plotly_chart)
    """
    import plotly.graph_objects as go

    # Build a manageable sub-graph: exporter's neighbours + their neighbours
    if highlight_exporter and highlight_exporter in G:
        seed = highlight_exporter
    elif highlight_buyer and highlight_buyer in G:
        seed = highlight_buyer
    else:
        # Fall back to highest-degree node
        if G.number_of_nodes() == 0:
            return None
        seed = max(G.nodes(), key=lambda n: G.degree(n))

    # 2-hop ego graph (capped at 80 nodes for clarity)
    sub_nodes = {seed}
    for nb in G.neighbors(seed):
        sub_nodes.add(nb)
        if len(sub_nodes) > 80:
            break
        for nb2 in G.neighbors(nb):
            sub_nodes.add(nb2)
            if len(sub_nodes) > 80:
                break
    subG = G.subgraph(sub_nodes)

    pos = nx.spring_layout(subG, seed=42, k=0.35, iterations=50)

    # ── Edges ────────────────────────────────────────────────────
    edge_x, edge_y = [], []
    for u, v in subG.edges():
        x0, y0 = pos[u]
        x1, y1 = pos[v]
        edge_x += [x0, x1, None]
        edge_y += [y0, y1, None]

    edge_trace = go.Scatter(
        x=edge_x, y=edge_y,
        mode="lines",
        line=dict(width=0.5, color="rgba(150,150,150,0.3)"),
        hoverinfo="none",
    )

    # ── Nodes ────────────────────────────────────────────────────
    node_x, node_y, node_color, node_size, node_text = [], [], [], [], []
    for node in subG.nodes():
        x, y = pos[node]
        node_x.append(x)
        node_y.append(y)
        is_exporter = str(node).startswith("E")
        degree = subG.degree(node)

        if node == highlight_exporter:
            node_color.append("#ef4444")   # red
            node_size.append(18)
        elif node == highlight_buyer:
            node_color.append("#f97316")   # orange
            node_size.append(16)
        elif is_exporter:
            node_color.append("#3b82f6")   # blue
            node_size.append(8 + min(degree, 12))
        else:
            node_color.append("#22c55e")   # green
            node_size.append(6 + min(degree, 10))

        node_text.append(f"{node}<br>Degree: {degree}")

    node_trace = go.Scatter(
        x=node_x, y=node_y,
        mode="markers",
        marker=dict(size=node_size, color=node_color, line=dict(width=0.5, color="#1e293b")),
        text=node_text,
        hoverinfo="text",
    )

    fig = go.Figure(data=[edge_trace, node_trace])
    fig.update_layout(
        showlegend=False,
        height=420,
        margin=dict(t=10, b=10, l=10, r=10),
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
    )
    return fig
