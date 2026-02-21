# ForeTrade Database Layer

SQLite + SQLAlchemy 2.0 ORM. All APIs return **native Python types** (dict/list/primitives) for Streamlit safety.

## Setup

```bash
pip install sqlalchemy>=2.0.0
```

Database file: `data/foretrade.db` (or set `FORETRADE_DB_PATH`).

## Init on app start

```python
from db import init_db, init_demo_accounts

# Once at startup (e.g. in app.py main())
init_db()
init_demo_accounts()
```

## Streamlit integration examples

### Auth (replace session-only auth)

```python
from db import verify_user, create_user, get_user_by_email

# Login
user = verify_user(email, password)
if user:
    st.session_state["authenticated"] = True
    st.session_state["user"] = user
    st.session_state["user_id"] = user["id"]
else:
    st.error("Invalid email or password.")

# Sign up
try:
    user = create_user(email, password, first_name=first_name, last_name=last_name, company=company)
    st.session_state["user_id"] = user["id"]
    st.success("Account created. Sign in.")
except ValueError as e:
    st.error(str(e))
```

### Save swipe decision

```python
from db import save_swipe

# After user swipes (you have user_id from session, match from your ranking)
save_swipe(
    user_id=st.session_state["user_id"],
    exporter_id=config["exporter_id"],
    buyer_id=match["buyer_id"],
    direction="right",  # or "left", "skip"
    match_score=match.get("score"),
    breakdown=match.get("breakdown"),  # dict; numpy types auto-sanitized
)
```

### Approved leads

```python
from db import save_approved_lead, get_user_approved_leads, update_lead_status

# When user swipes right → save as approved lead
lead = save_approved_lead(
    user_id=st.session_state["user_id"],
    exporter_id=exporter_id,
    buyer_id=match["buyer_id"],
    buyer_details=match.get("importer_details"),  # from your card
    match_analysis={"score": match["score"], "breakdown": match["breakdown"]},
    pipeline_status="pending",
)

# List leads for Approved Leads page
leads = get_user_approved_leads(st.session_state["user_id"], exporter_id=exporter_id)

# Update pipeline (e.g. "Contacted")
updated = update_lead_status(lead_id=lead["id"], pipeline_status="contacted")
```

### Conversation (AI chat per lead)

```python
from db import save_conversation_message, get_conversation_history

# Append user message
save_conversation_message(lead_id=lead_id, role="user", message=user_text)
# After Gemini reply
save_conversation_message(lead_id=lead_id, role="bot", message=bot_reply)

# Load history for context
history = get_conversation_history(lead_id=lead_id)
```

### User weights (personalization)

```python
from db import save_user_weights, get_user_weights

# After user changes sliders (or RLHF update)
save_user_weights(user_id=st.session_state["user_id"], weights=current_weights, version=1)

# Load for sidebar defaults
w = get_user_weights(st.session_state["user_id"])
if w:
    weights = w["weights"]
```

### Analytics (dashboard)

```python
from db import get_user_analytics

stats = get_user_analytics(st.session_state["user_id"])
# stats["total_swipes"], stats["approved_count"], stats["approval_rate"], stats["leads_by_status"]
```

## Testing each function

Run the test script (see `test_db.py`) or call from Python:

```python
from db import (
    init_db, init_demo_accounts, verify_user, create_user,
    save_swipe, save_approved_lead, get_user_approved_leads, update_lead_status,
    save_conversation_message, get_conversation_history,
    save_user_weights, get_user_weights, get_user_analytics,
)

init_db()
init_demo_accounts()

# Verify demo user
u = verify_user("shravan@foretrade.ai", "shravan123")
assert u and u["email"] == "shravan@foretrade.ai"

# Create user (optional)
u2 = create_user("test@test.com", "secret", first_name="Test", company="Test Co.")

# Swipe
save_swipe(u["id"], "E001", "B001", "right", match_score=85.0, breakdown={"product_compatibility": 0.9})

# Lead
lead = save_approved_lead(u["id"], "E001", "B001", buyer_details={"industry": "Electronics"})
leads = get_user_approved_leads(u["id"])
update_lead_status(lead["id"], "contacted")

# Conversation
save_conversation_message(lead["id"], "user", "Hello")
save_conversation_message(lead["id"], "bot", "Hi! How can I help?")
history = get_conversation_history(lead["id"])

# Weights
save_user_weights(u["id"], {"product_compatibility": 0.25})
w = get_user_weights(u["id"])

# Analytics
analytics = get_user_analytics(u["id"])
```

## Error handling

- `verify_user`: returns `None` if wrong credentials.
- `create_user`: raises `ValueError` for duplicate email or missing fields.
- `save_swipe`: raises `ValueError` if `direction` not in `("right", "left", "skip")`.
- `update_lead_status`: raises `ValueError` for invalid status; returns `None` if lead not found.
- `save_conversation_message`: raises `ValueError` if role invalid or lead_id not found.
- All JSON inputs (breakdown, buyer_details, match_analysis, weights) are sanitized from numpy/pandas types via `_sanitize_for_json()`.

## Data types

- Pass **dicts/lists/primitives** from Pandas/NumPy; they are sanitized before insert.
- All returned values are JSON-serializable (datetime as ISO string, no ORM objects).
