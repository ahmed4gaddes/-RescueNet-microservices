"""Entraîne le modèle de triage sur un jeu de données synthétique et le sauvegarde en .joblib."""
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

from app.features import FEATURES, SYMPTOM_FLAGS

SEVERITIES = ["VERT", "ORANGE", "ROUGE"]
rng = np.random.default_rng(42)


def rule_score(row: dict) -> float:
    """Score clinique synthétique (0-100) utilisé pour fabriquer les étiquettes."""
    s = 0.0
    s += 35 if row["spo2"] < 90 else 15 if row["spo2"] < 94 else 0
    s += 25 if row["heartRate"] > 130 or row["heartRate"] < 45 else 10 if row["heartRate"] > 110 else 0
    s += 30 if row["systolicBP"] < 90 else 12 if row["systolicBP"] < 100 or row["systolicBP"] > 180 else 0
    s += {0: 0, 1: 15, 2: 30, 3: 45}[row["consciousness"]]
    s += row["painLevel"] * 2
    s += 15 if row["age"] > 70 or row["age"] < 5 else 0
    s += 30 * row["chest_pain"] + 30 * row["breathing_difficulty"] + 28 * row["stroke_signs"]
    s += 25 * row["severe_bleeding"] + 15 * row["trauma"] + 8 * row["abdominal_pain"] + 3 * row["fever"]
    s += 20 * row["seizure"] + 35 * row["cardiac_arrest"]
    return s


def make_dataset(n: int = 6000):
    X, y = [], []
    for _ in range(n):
        critical = rng.random() < 0.3
        row = {
            "age": int(rng.integers(1, 95)),
            "heartRate": int(rng.normal(125 if critical else 82, 22 if critical else 12)),
            "spo2": int(np.clip(rng.normal(88 if critical else 97, 5 if critical else 2), 60, 100)),
            "systolicBP": int(rng.normal(95 if critical else 122, 28 if critical else 14)),
            "consciousness": int(rng.choice([0, 1, 2, 3], p=[0.5, 0.2, 0.2, 0.1] if critical else [0.93, 0.05, 0.015, 0.005])),
            "painLevel": int(np.clip(rng.normal(7 if critical else 3, 2), 0, 10)),
        }
        for flag in SYMPTOM_FLAGS:
            base = 0.35 if critical else 0.06
            row[flag] = int(rng.random() < base)
        score = rule_score(row) + rng.normal(0, 6)
        label = 2 if score >= 70 else 1 if score >= 35 else 0
        X.append([row[f] for f in FEATURES])
        y.append(label)
    return np.array(X), np.array(y)


if __name__ == "__main__":
    X, y = make_dataset()
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    model = RandomForestClassifier(n_estimators=150, max_depth=12, random_state=42, n_jobs=-1)
    model.fit(X_tr, y_tr)
    print(classification_report(y_te, model.predict(X_te), target_names=SEVERITIES))
    joblib.dump(model, "triage_model.joblib")
    print("Modèle sauvegardé : triage_model.joblib")
