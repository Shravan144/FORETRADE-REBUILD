# engine/news_engine.py

import pandas as pd
from datetime import datetime, timedelta
from urllib.parse import quote_plus


class NewsEngine:

    def __init__(self, news_csv_path):
        self.df = pd.read_csv(news_csv_path)
        self.df['Date'] = pd.to_datetime(self.df['Date'])

    def get_recent_news(self, industry, days_back=60):
        """Get news affecting a specific industry in last N days"""
        cutoff = self.df['Date'].max() - timedelta(days=days_back)
        filtered = self.df[
            (self.df['Affected_Industry'] == industry) &
            (self.df['Date'] >= cutoff)
        ]
        return filtered

    def calculate_modifier(self, industry):
        """
        Returns:
          modifier : float between 0.5 and 1.3 — multiply match score by this
          alerts   : list of dicts to display on the UI

        Aggregation: We group events by type and take the single strongest
        modifier per type (weighted by impact level).  This prevents
        stacking 6 identical war events into 0.7^6 ≈ 0.12.
        """
        news = self.get_recent_news(industry)
        alerts = []

        # ── per-event-type aggregation ────────────────────────────
        # For each type we keep the *worst single modifier* (strongest
        # effect) so the result is realistic, not multiplicatively
        # catastrophic.
        impact_weight = {'High': 1.0, 'Medium': 0.6, 'Low': 0.3}
        type_modifiers: dict[str, float] = {}   # event_type → worst modifier
        type_counts:    dict[str, int]   = {}

        for _, row in news.iterrows():
            event  = row['Event_Type']
            impact = row['Impact_Level']
            iw     = impact_weight.get(impact, 0.5)

            if event == 'Trade Agreement':
                base = 1.0 + 0.12 * iw         # 1.04 .. 1.12
                key  = 'Trade Agreement'
                msg  = f"Trade Agreement active for {industry}"
                a_type, icon = 'success', '📈'

            elif row.get('War_Flag', 0) == 1:
                base = 1.0 - 0.15 * iw         # 0.955 .. 0.85
                key  = 'War Alert'
                msg  = f"War alert affecting {industry} trade routes"
                a_type, icon = 'error', '⚠️'

            elif event == 'Tariff Update':
                tariff = float(row.get('Tariff_Change', 0) or 0)
                if tariff > 0.3:
                    base = 1.0 - 0.08 * iw     # 0.976 .. 0.92
                    key  = 'Tariff Hike'
                    msg  = f"Tariff increase on {industry} imports"
                    a_type, icon = 'warning', '💰'
                elif tariff < 0:
                    base = 1.0 + 0.06 * iw      # 1.02 .. 1.06
                    key  = 'Tariff Reduction'
                    msg  = f"Tariff reduction benefits {industry}"
                    a_type, icon = 'success', '💰'
                else:
                    continue

            elif row.get('Natural_Calamity_Flag', 0) == 1:
                base = 1.0 - 0.10 * iw         # 0.97 .. 0.90
                key  = 'Natural Calamity'
                msg  = f"Natural calamity disrupting {industry} supply chains"
                a_type, icon = 'error', '🌊'

            elif event == 'Stock Crash':
                base = 1.0 - 0.05 * iw         # 0.985 .. 0.95
                key  = 'Stock Crash'
                msg  = f"Stock market shock affecting {industry} buyers"
                a_type, icon = 'warning', '📉'
            else:
                continue

            type_counts[key] = type_counts.get(key, 0) + 1

            # Keep the most extreme modifier per type
            prev = type_modifiers.get(key, 1.0)
            if base < 1.0:
                type_modifiers[key] = min(prev, base)   # worst penalty
            else:
                type_modifiers[key] = max(prev, base)   # best boost

            # Build alert (de-duped later)
            pct = abs(base - 1.0) * 100
            sign = '+' if base >= 1.0 else '-'
            region = row.get('Region', 'Global')
            date_str = row['Date'].strftime('%b %d, %Y') if pd.notna(row['Date']) else ''
            impact_lvl = row.get('Impact_Level', 'Medium')
            search_q = quote_plus(f"{event} {industry} {region} trade news")
            search_url = f"https://news.google.com/search?q={search_q}"
            alerts.append({
                'type':       a_type,
                'icon':       icon,
                'message':    msg,
                'impact':     f"{sign}{pct:.0f}% to match score",
                'region':     region,
                'date':       date_str,
                'severity':   impact_lvl,
                'event_type': key,
                'search_url': search_url,
            })

        # Combine one modifier per type
        modifier = 1.0
        for m in type_modifiers.values():
            modifier *= m

        # Cap modifier
        modifier = min(max(modifier, 0.5), 1.3)

        # Deduplicate alerts
        seen, unique_alerts = set(), []
        for a in alerts:
            if a['message'] not in seen:
                seen.add(a['message'])
                unique_alerts.append(a)

        return round(modifier, 3), unique_alerts

    def apply_to_matches(self, matches_df, industry_col='Industry'):
        """
        Takes your matches DataFrame and adds:
          news_modifier  — the multiplier used
          adjusted_score — score after news adjustment
          alerts         — list of alert dicts for UI
        """
        modifiers, all_alerts = [], []

        for _, row in matches_df.iterrows():
            modifier, alerts = self.calculate_modifier(row[industry_col])
            modifiers.append(modifier)
            all_alerts.append(alerts)

        result = matches_df.copy()
        result['news_modifier']  = modifiers
        result['adjusted_score'] = (
            result['score'] * result['news_modifier']
        ).clip(0, 100).round(1)
        result['alerts'] = all_alerts

        return result.sort_values('adjusted_score', ascending=False)

    def simulate_event(self, matches_df, event_type, industry, score_col='score'):
        """
        For the live demo simulation widget.
        Applies a fake one-off news event and returns adjusted scores.
        """
        modifiers = {
            'War Alert':        0.70,
            'Trade Agreement':  1.20,
            'Tariff Hike':      0.85,
            'Tariff Reduction': 1.10,
            'Natural Calamity': 0.80,
            'Stock Crash':      0.90,
        }
        modifier = modifiers.get(event_type, 1.0)
        result   = matches_df.copy()

        mask = result['Industry'] == industry
        result.loc[mask,  'simulated_score'] = (
            result.loc[mask, score_col] * modifier
        ).clip(0, 100).round(1)
        result.loc[~mask, 'simulated_score'] = result.loc[~mask, score_col]

        result['score_change'] = (
            result['simulated_score'] - result[score_col]
        ).round(1)

        return result.sort_values('simulated_score', ascending=False)
