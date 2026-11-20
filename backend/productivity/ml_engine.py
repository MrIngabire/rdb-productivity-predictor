"""Scikit-Learn Random Forest engine.

The model only ever sees two anonymised numeric features (task completion rate and
working hours). Names, IDs and departments never reach it, which satisfies the
privacy mitigation in section 1.6 of the project book.
"""
import json
import logging
import threading
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from django.conf import settings
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import accuracy_score, mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

logger = logging.getLogger(__name__)

MODEL_DIR = Path(settings.BASE_DIR) / "ml_models"
MODEL_PATH = MODEL_DIR / "random_forest_productivity_predictor.pkl"
META_PATH = MODEL_DIR / "model_meta.json"
FEATURES = ["task_completion_rate", "working_hours_logged"]

_lock = threading.RLock()
_model = None


def synthetic_dataset(n_samples=4000, seed=42):
    """Baseline training data: end-of-term score as a function of completion rate and hours.

    Replace this with real historical RDB logs when they become available.
    """
    rng = np.random.default_rng(seed)
    completion = rng.uniform(5, 100, n_samples)
    hours = np.clip(rng.normal(7.5, 1.8, n_samples), 2, 13)
    hours_effect = np.where(hours < 8, (hours - 8) * 1.8, -np.maximum(0, hours - 9.5) * 1.5)
    score = np.clip(0.9 * completion + hours_effect + rng.normal(0, 6, n_samples), 0, 100)
    return np.column_stack([completion, hours]), score


def train_and_save(pass_threshold=50.0, n_estimators=100, max_depth=8, n_samples=4000, seed=42):
    global _model
    X, y = synthetic_dataset(n_samples, seed)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=seed)
    model = RandomForestRegressor(
        n_estimators=int(n_estimators),
        max_depth=int(max_depth),
        min_samples_leaf=5,
        random_state=seed,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    meta = {
        "algorithm": "RandomForestRegressor",
        "features": FEATURES,
        "n_estimators": int(n_estimators),
        "max_depth": int(max_depth),
        "pass_threshold": float(pass_threshold),
        "training_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "accuracy": round(float(accuracy_score(y_test < pass_threshold, pred < pass_threshold)), 4),
        "mae": round(float(mean_absolute_error(y_test, pred)), 3),
        "r2": round(float(r2_score(y_test, pred)), 4),
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    META_PATH.write_text(json.dumps(meta, indent=2))
    with _lock:
        _model = model
    logger.info("Trained productivity model: %s", meta)
    return meta


def _load():
    global _model
    with _lock:
        if _model is None:
            if not MODEL_PATH.exists():
                logger.warning("No trained model found; training a baseline model now.")
                train_and_save()
            else:
                _model = joblib.load(MODEL_PATH)
        return _model


def model_meta():
    if not META_PATH.exists():
        _load()
    try:
        return json.loads(META_PATH.read_text())
    except (OSError, ValueError):
        return {}


def predict(task_completion_rate, working_hours_logged, pass_threshold=50.0):
    """Return the predicted end-of-term score and the confidence in the pass/fail verdict."""
    model = _load()
    features = np.array([[float(task_completion_rate), float(working_hours_logged)]])
    tree_scores = np.array([tree.predict(features)[0] for tree in model.estimators_])
    score = float(np.clip(tree_scores.mean(), 0, 100))
    if score < pass_threshold:
        agree = float(np.mean(tree_scores < pass_threshold))
    else:
        agree = float(np.mean(tree_scores >= pass_threshold))
    return {"score": round(score, 1), "confidence": round(agree * 100, 1)}
