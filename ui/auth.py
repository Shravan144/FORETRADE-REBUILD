"""
=============================================================================
AUTH UI COMPONENT — ForeTrade
=============================================================================
Polished login / sign-up page using Streamlit session state.
No external database needed — credentials stored in session for demo.
=============================================================================
"""

import streamlit as st
import hashlib
import time

# Demo accounts (expandable — add DB later)
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

        # Check against demo accounts + runtime signups
        all_accounts = {**DEMO_ACCOUNTS, **st.session_state.get("user_accounts", {})}
        account = all_accounts.get(email.lower().strip())

        if account and account["password_hash"] == _hash(password):
            st.session_state["authenticated"] = True
            st.session_state["user"] = {
                "email": email.lower().strip(),
                "first_name": account["first_name"],
                "last_name": account["last_name"],
                "role": account["role"],
                "company": account.get("company", ""),
                "industry": account.get("industry", ""),
                "phone": account.get("phone", ""),
            }
            st.rerun()
        else:
            st.error("Invalid email or password. Please try again.")


def _render_signup():
    with st.form("signup_form", clear_on_submit=True):
        c1, c2 = st.columns(2)
        with c1:
            first_name = st.text_input("First Name", placeholder="Arjun")
        with c2:
            last_name = st.text_input("Last Name", placeholder="Mehta")

        email = st.text_input("Email", placeholder="you@company.com", key="signup_email")
        company = st.text_input("Company Name", placeholder="Your Export Company")
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

        all_accounts = {**DEMO_ACCOUNTS, **st.session_state.get("user_accounts", {})}
        if email.lower().strip() in all_accounts:
            st.error("An account with this email already exists.")
            return

        # Create account in session state
        if "user_accounts" not in st.session_state:
            st.session_state["user_accounts"] = {}

        st.session_state["user_accounts"][email.lower().strip()] = {
            "password_hash": _hash(password),
            "first_name": first_name,
            "last_name": last_name,
            "role": "Export Manager",
            "company": company,
            "industry": "",
            "email": email.lower().strip(),
            "phone": "",
        }

        st.markdown("""<div class="signup-success">
✅ Account created successfully! Switch to the <strong>Sign In</strong> tab to log in.
</div>""", unsafe_allow_html=True)


def logout():
    """Clear auth state."""
    for key in ["authenticated", "user"]:
        if key in st.session_state:
            del st.session_state[key]
