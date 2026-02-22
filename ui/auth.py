"""
=============================================================================
AUTH UI COMPONENT — ForeTrade
=============================================================================
Login/sign-up: uses SQLite DB when available, else session-only (no crash).
=============================================================================
"""

import streamlit as st
import hashlib

# Optional DB: use when available so we get user_id for persistence
try:
    from db import verify_user as db_verify_user, create_user as db_create_user
except Exception:
    db_verify_user = None
    db_create_user = None

# Demo accounts (fallback when DB unavailable or for in-session signups)
DEMO_ACCOUNTS = {
    "shravan@foretrade.ai": {
        "password_hash": hashlib.sha256("shravan123".encode()).hexdigest(),
        "first_name": "Shravan",
        "last_name": "",
        "role": "Export Manager",
        "company": "Precision Manufacturing Co.",
        "industry": "Engineering",
        "email": "shravan@foretrade.ai",
        "phone": "+91 98765 43210",
    },
    "admin@foretrade.ai": {
        "password_hash": hashlib.sha256("Admin123!".encode()).hexdigest(),
        "first_name": "Priya",
        "last_name": "Sharma",
        "role": "Director",
        "company": "ForeTrade Technologies",
        "industry": "IT Software",
        "email": "admin@foretrade.ai",
        "phone": "+91 91234 56789",
    },
}


def _hash(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def _inject_auth_css():
    st.markdown("""
<style>
/* Hide default Streamlit header & footer during login */
[data-testid="stSidebar"] { display: none !important; }
header[data-testid="stHeader"] { display: none !important; }
footer { display: none !important; }

/* Full-page gradient background */
.stApp {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 40%, #0f172a 100%) !important;
}

.login-container {
    max-width: 440px;
    margin: 40px auto 0;
    padding: 40px 36px 32px;
    background: rgba(255,255,255,0.97);
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    backdrop-filter: blur(20px);
}
.login-logo {
    text-align: center;
    margin-bottom: 8px;
}
.login-logo h1 {
    font-size: 2em;
    margin: 0;
    background: linear-gradient(135deg, #0ea5e9, #22c55e);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 800;
    letter-spacing: -0.5px;
}
.login-logo p {
    color: #64748b;
    font-size: 0.88em;
    margin: 4px 0 0;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-weight: 600;
}
.login-subtitle {
    text-align: center;
    color: #555;
    font-size: 1.05em;
    margin: 24px 0 8px;
}
.login-subtitle h2 {
    font-size: 1.3em;
    color: #0f172a;
    margin-bottom: 4px;
    font-weight: 700;
}
.login-hint {
    background: linear-gradient(135deg, #eff6ff, #f0fdf4);
    border-left: 4px solid #0ea5e9;
    border-radius: 10px;
    padding: 14px 18px;
    margin-top: 20px;
    font-size: 0.85em;
    color: #1e40af;
}
.signup-success {
    background: #f0fdf4;
    border-left: 4px solid #22c55e;
    border-radius: 10px;
    padding: 14px 18px;
    margin-top: 12px;
    font-size: 0.9em;
    color: #166534;
}

/* Style the tab container on auth page */
.stTabs [data-baseweb="tab"] {
    font-weight: 600;
    color: #64748b;
}
.stTabs [data-baseweb="tab"][aria-selected="true"] {
    color: #0ea5e9 !important;
    border-bottom-color: #0ea5e9 !important;
}

/* Auth buttons */
.stButton > button[kind="primary"] {
    background: linear-gradient(135deg, #0ea5e9, #0284c7) !important;
    border: none !important;
    border-radius: 10px !important;
    font-weight: 700 !important;
    padding: 12px 24px !important;
    box-shadow: 0 2px 8px rgba(14,165,233,0.3) !important;
}
.stButton > button[kind="primary"]:hover {
    background: linear-gradient(135deg, #38bdf8, #0ea5e9) !important;
    box-shadow: 0 4px 16px rgba(14,165,233,0.4) !important;
}

/* Text inputs on auth page */
.stTextInput > div > div {
    border-radius: 10px !important;
}
.stTextInput > div > div:focus-within {
    border-color: #0ea5e9 !important;
    box-shadow: 0 0 0 2px rgba(14,165,233,0.15) !important;
}
</style>
""", unsafe_allow_html=True)


def render_login_page() -> bool:
    """
    Render login/sign-up form. Returns True if user is authenticated.
    """
    _inject_auth_css()

    if st.session_state.get("authenticated"):
        return True

    # Try to restore session from localStorage (survives page reloads)
    if not st.session_state.get("_auth_check_done"):
        st.markdown("""
        <script>
        // Check localStorage for saved session
        const saved = localStorage.getItem('foretrade_session');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                // Send back to Streamlit via query params trick
                const params = new URLSearchParams(window.location.search);
                params.set('auto_auth', JSON.stringify(data));
                window.history.replaceState({}, '', '?' + params.toString());
            } catch(e) {}
        }
        </script>
        """, unsafe_allow_html=True)
        
        # Check for auto-auth data in query params
        params = st.query_params
        if "auto_auth" in params:
            try:
                import json
                auth_data = json.loads(params.get("auto_auth"))
                st.session_state["authenticated"] = True
                st.session_state["user_id"] = auth_data.get("user_id")
                st.session_state["user"] = auth_data.get("user")
                st.session_state["_auth_check_done"] = True
                st.rerun()
            except Exception:
                pass
        st.session_state["_auth_check_done"] = True

    # Logo
    st.markdown("""<div class="login-logo">
<div style="font-size:2.4em;margin-bottom:4px;">🌍</div>
<h1>ForeTrade</h1>
<p>AI Export Engine</p>
</div>""", unsafe_allow_html=True)

    st.markdown("""<div class="login-subtitle">
<h2>Welcome Back</h2>
<p style="color:#94a3b8;font-size:.92em;">Sign in to your AI-powered export dashboard</p>
</div>""", unsafe_allow_html=True)

    # Tab toggle for login / signup
    tab_login, tab_signup = st.tabs(["Sign In", "Create Account"])

    with tab_login:
        _render_signin()

    with tab_signup:
        _render_signup()

    # Demo credentials hint
    st.markdown("""<div class="login-hint">
<strong>Demo credentials:</strong><br>
Email: <code>shravan@foretrade.ai</code><br>
Password: <code>shravan123</code>
</div>""", unsafe_allow_html=True)

    return st.session_state.get("authenticated", False)


def _render_signin():
    with st.form("login_form", clear_on_submit=False):
        email = st.text_input("Email / Username", placeholder="shravan@foretrade.ai")
        password = st.text_input("Password", type="password", placeholder="Enter your password")
        submitted = st.form_submit_button("Sign In", type="primary", width="stretch")

    if submitted:
        if not email or not password:
            st.error("Please enter both email and password.")
            return

        email = email.strip().lower()

        # 1) Try DB first (so we get user_id for swipe/lead persistence)
        if db_verify_user:
            try:
                user = db_verify_user(email, password)
                if user:
                    st.session_state["authenticated"] = True
                    st.session_state["user_id"] = user["id"]
                    st.session_state["user"] = {
                        "email": user["email"],
                        "first_name": user["first_name"],
                        "last_name": user["last_name"],
                        "role": user["role"],
                        "company": user.get("company", ""),
                        "industry": user.get("industry", ""),
                        "phone": user.get("phone", ""),
                    }
                    # Save to localStorage for reload persistence
                    import json
                    session_data = json.dumps({
                        "user_id": user["id"],
                        "user": st.session_state["user"]
                    })
                    st.markdown(f"""
                    <script>
                    localStorage.setItem('foretrade_session', '{session_data}');
                    </script>
                    """, unsafe_allow_html=True)
                    st.rerun()
                    return
            except Exception:
                pass  # fall back to session accounts

        # 2) Fallback: demo accounts + runtime signups
        all_accounts = {**DEMO_ACCOUNTS, **st.session_state.get("user_accounts", {})}
        account = all_accounts.get(email)
        if account and account["password_hash"] == _hash(password):
            st.session_state["authenticated"] = True
            st.session_state["user"] = {
                "email": email,
                "first_name": account["first_name"],
                "last_name": account["last_name"],
                "role": account["role"],
                "company": account.get("company", ""),
                "industry": account.get("industry", ""),
                "phone": account.get("phone", ""),
            }
            # No user_id when using session-only auth
            if "user_id" in st.session_state:
                del st.session_state["user_id"]
            # Save to localStorage for reload persistence
            import json
            session_data = json.dumps({
                "user_id": None,
                "user": st.session_state["user"]
            })
            st.markdown(f"""
            <script>
            localStorage.setItem('foretrade_session', '{session_data}');
            </script>
            """, unsafe_allow_html=True)
            st.rerun()
        else:
            st.error("Invalid email or password. Please try again.")


def _render_signup():
    # Industry options for dropdown
    INDUSTRY_OPTIONS = [
        "Engineering",
        "IT Software",
        "Electronics",
        "Textiles",
        "Pharmaceuticals",
        "Agriculture",
        "Chemicals",
        "Automotive",
        "Food & Beverages",
        "Handicrafts",
        "Leather Goods",
        "Jewelry & Gems",
        "Plastics",
        "Metals",
        "Machinery",
        "Medical Devices",
        "Renewable Energy",
        "Other"
    ]
    
    with st.form("signup_form", clear_on_submit=True):
        c1, c2 = st.columns(2)
        with c1:
            first_name = st.text_input("First Name", placeholder="Arjun")
        with c2:
            last_name = st.text_input("Last Name", placeholder="Mehta")

        email = st.text_input("Email", placeholder="you@company.com", key="signup_email")
        company = st.text_input("Company Name", placeholder="Your Export Company")
        industry = st.selectbox("Industry", options=INDUSTRY_OPTIONS, index=0, key="signup_industry")
        phone = st.text_input("Phone", placeholder="e.g. +91 98765 43210", key="signup_phone")
        password = st.text_input("Password", type="password", placeholder="Min 6 characters", key="signup_pw")
        password2 = st.text_input("Confirm Password", type="password", placeholder="Repeat password", key="signup_pw2")
        submitted = st.form_submit_button("Create Account", type="primary", width="stretch")

    if submitted:
        if not all([first_name, last_name, email, password, password2]):
            st.error("Please fill in all fields.")
            return
        if password != password2:
            st.error("Passwords do not match.")
            return
        if len(password) < 6:
            st.error("Password must be at least 6 characters.")
            return

        email = email.strip().lower()

        # 1) Try DB first
        if db_create_user:
            try:
                db_create_user(
                    email, password,
                    first_name=first_name or "",
                    last_name=last_name or "",
                    company=company or "",
                    industry=(industry or "").strip(),
                    phone=(phone or "").strip(),
                )
                st.markdown("""<div class="signup-success">
✅ Account created successfully! Switch to the <strong>Sign In</strong> tab to log in.
</div>""", unsafe_allow_html=True)
                return
            except ValueError as e:
                if "already exists" in str(e).lower():
                    st.error("An account with this email already exists.")
                    return
                st.error(str(e))
                return
            except Exception:
                pass  # fall back to session

        # 2) Fallback: session-only signup
        all_accounts = {**DEMO_ACCOUNTS, **st.session_state.get("user_accounts", {})}
        if email in all_accounts:
            st.error("An account with this email already exists.")
            return
        if "user_accounts" not in st.session_state:
            st.session_state["user_accounts"] = {}
        st.session_state["user_accounts"][email] = {
            "password_hash": _hash(password),
            "first_name": first_name,
            "last_name": last_name,
            "role": "Export Manager",
            "company": company,
            "industry": (industry or "").strip(),
            "email": email,
            "phone": (phone or "").strip(),
        }
        st.markdown("""<div class="signup-success">
✅ Account created successfully! Switch to the <strong>Sign In</strong> tab to log in.
</div>""", unsafe_allow_html=True)


def logout():
    """Clear auth state (session + DB user_id). So next login loads approved leads from DB again."""
    for key in ["authenticated", "user", "user_id", "_connected_loaded_from_db", "connected", "swipe_history", "card_index", "current_matches", "_auth_check_done"]:
        if key in st.session_state:
            del st.session_state[key]
    # Clear browser localStorage
    st.markdown("""
    <script>
    localStorage.removeItem('foretrade_session');
    </script>
    """, unsafe_allow_html=True)
