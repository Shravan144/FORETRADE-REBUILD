"""
=============================================================================
MODEL CACHE — ForeTrade
=============================================================================
Pickle-based disk cache so heavy ML models train ONCE and reload in <1 s
on subsequent app starts.  Cache is stored in data/_model_cache/.

Usage:
    from engine.model_cache import cache_exists, load_cache, save_cache

    if cache_exists("gb_rf"):
        result = load_cache("gb_rf")
    else:
        result = train_heavy_model(...)
        save_cache("gb_rf", result)
=============================================================================
"""

import os
import pickle
import hashlib
from typing import Any, Optional

_CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "_model_cache")


def _ensure_dir():
    os.makedirs(_CACHE_DIR, exist_ok=True)


def _path(key: str) -> str:
    return os.path.join(_CACHE_DIR, f"{key}.pkl")


def cache_exists(key: str) -> bool:
    """Check if a cached model exists on disk."""
    return os.path.isfile(_path(key))


def load_cache(key: str) -> Optional[Any]:
    """Load a pickled object from disk. Returns None on failure."""
    try:
        with open(_path(key), "rb") as f:
            return pickle.load(f)
    except Exception:
        return None


def save_cache(key: str, obj: Any) -> None:
    """Persist an object to disk as pickle."""
    _ensure_dir()
    try:
        with open(_path(key), "wb") as f:
            pickle.dump(obj, f, protocol=pickle.HIGHEST_PROTOCOL)
    except Exception:
        pass  # Non-critical — next run will just retrain


def invalidate(key: str) -> None:
    """Delete a cached model (e.g. after RLHF retrain)."""
    try:
        os.remove(_path(key))
    except FileNotFoundError:
        pass


def invalidate_all() -> None:
    """Wipe the entire cache directory."""
    _ensure_dir()
    for f in os.listdir(_CACHE_DIR):
        if f.endswith(".pkl"):
            try:
                os.remove(os.path.join(_CACHE_DIR, f))
            except Exception:
                pass
