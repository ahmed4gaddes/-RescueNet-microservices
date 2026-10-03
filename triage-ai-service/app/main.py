import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import joblib
import py_eureka_client.eureka_client as eureka_client
from fastapi import Depends, FastAPI
from pydantic import BaseModel, Field
from sqlalchemy import JSON, DateTime, Float, Integer, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from app.features import CONSCIOUSNESS, FEATURES, KEYWORDS, SPECIALTY_RULES, SYMPTOM_FLAGS

log = logging.getLogger("triage-ai")
logging.basicConfig(level=logging.INFO)

PORT = int(os.getenv("PORT", "8083"))
EUREKA_URL = os.getenv("EUREKA_URL", "http://localhost:8761/eureka/")
DB_URL = os.getenv("MYSQL_URL", "mysql+pymysql://rescue:rescue123@localhost:3306/triage_db")
MODEL_PATH = Path(__file__).resolve().parent.parent / "triage_model.joblib"
SEVERITIES = ["VERT", "ORANGE", "ROUGE"]

engine = create_engine(DB_URL, pool_pre_ping=True)
model = None


class Base(DeclarativeBase):
    pass


class TriageRecord(Base):
    __tablename__ = "triage_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    severity: Mapped[str] = mapped_column(String(10))
    score: Mapped[float] = mapped_column(Float)
    specialty: Mapped[str] = mapped_column(String(30))
    request: Mapped[dict] = mapped_column(JSON)


def get_session():
    with Session(engine) as session:
        yield session


def wait_for_db(retries: int = 30):
    for attempt in range(1, retries + 1):
        try:
            Base.metadata.create_all(engine)
            log.info("MySQL prêt")
            return
        except Exception as exc:  # noqa: BLE001
            log.warning("MySQL indisponible (%s/%s) : %s", attempt, retries, exc.__class__.__name__)
            time.sleep(2)
    raise RuntimeError("MySQL injoignable")


@asynccontextmanager
async def lifespan(_: FastAPI):
    global model
    if not MODEL_PATH.exists():
        raise RuntimeError("triage_model.joblib manquant : lance `python train_model.py`")
    model = joblib.load(MODEL_PATH)
    wait_for_db()
    await eureka_client.init_async(
        eureka_server=EUREKA_URL,
        app_name="triage-ai-service",
        instance_port=PORT,
        instance_host="localhost",
        instance_ip="127.0.0.1",
        health_check_url=f"http://127.0.0.1:{PORT}/health",
        renewal_interval_in_secs=10,
        duration_in_secs=30,
    )
    log.info("Enregistré dans Eureka")
    yield
    await eureka_client.stop_async()


app = FastAPI(title="Triage AI Service", version="1.0.0", lifespan=lifespan)


class Vitals(BaseModel):
    heartRate: int = Field(80, ge=0, le=300)
    spo2: int = Field(98, ge=0, le=100)
    systolicBP: int = Field(120, ge=0, le=300)
    consciousness: str = Field("ALERT", description="ALERT | VOICE | PAIN | UNRESPONSIVE")
    painLevel: int = Field(0, ge=0, le=10)


class TriageRequest(BaseModel):
    age: int = Field(..., ge=0, le=120)
    symptoms: list[str] = []
    vitals: Vitals = Vitals()
    medicalHistory: list[str] = []


class TriageResponse(BaseModel):
    severity: str
    score: float
    specialty: str
    explanation: str


def detect_flags(symptoms: list[str]) -> dict[str, int]:
    text = " ".join(symptoms).lower()
    return {flag: int(any(k in text for k in KEYWORDS[flag])) for flag in SYMPTOM_FLAGS}


def pick_specialty(flags: dict[str, int], history: list[str]) -> str:
    for flag, specialty in SPECIALTY_RULES:
        if flags[flag]:
            return specialty
    if any(h in " ".join(history).lower() for h in ("cardi", "hypertens", "infarct")) and flags["abdominal_pain"] == 0:
        return "CARDIOLOGY" if flags["breathing_difficulty"] else "GENERAL"
    return "GENERAL"


@app.post("/api/triage", response_model=TriageResponse)
def triage(req: TriageRequest, session: Session = Depends(get_session)):
    flags = detect_flags(req.symptoms)
    v = req.vitals
    consciousness = CONSCIOUSNESS.get(v.consciousness.upper(), 0)
    row = {
        "age": req.age, "heartRate": v.heartRate, "spo2": v.spo2, "systolicBP": v.systolicBP,
        "consciousness": consciousness, "painLevel": v.painLevel, **flags,
    }
    probs = model.predict_proba([[row[f] for f in FEATURES]])[0]
    classes = list(model.classes_)
    p = {SEVERITIES[c]: float(probs[classes.index(c)]) if c in classes else 0.0 for c in range(3)}
    idx = max(range(3), key=lambda i: p[SEVERITIES[i]])

    reasons = []
    if flags["cardiac_arrest"] or consciousness == 3 or v.spo2 < 85:
        idx = 2  # règle de sécurité : jamais sous-estimer ces cas
        reasons.append("règle de sécurité (arrêt cardiaque / inconscience / SpO2 < 85)")
    if v.spo2 < 94:
        reasons.append(f"SpO2 basse ({v.spo2}%)")
    if v.systolicBP < 100:
        reasons.append(f"hypotension ({v.systolicBP})")
    if v.heartRate > 120:
        reasons.append(f"tachycardie ({v.heartRate} bpm)")
    reasons += [f.replace("_", " ") for f, on in flags.items() if on]

    severity = SEVERITIES[idx]
    score = round(100 * (0.5 * p["ORANGE"] + p["ROUGE"]), 1)
    if severity == "ROUGE":
        score = max(score, 80.0)
    specialty = pick_specialty(flags, req.medicalHistory)
    explanation = "Facteurs : " + (", ".join(reasons) if reasons else "aucun signe de gravité")

    session.add(TriageRecord(severity=severity, score=score, specialty=specialty, request=req.model_dump()))
    session.commit()
    return TriageResponse(severity=severity, score=score, specialty=specialty, explanation=explanation)


@app.get("/api/triage/history")
def history(limit: int = 20, session: Session = Depends(get_session)):
    rows = session.scalars(select(TriageRecord).order_by(TriageRecord.id.desc()).limit(limit)).all()
    return [
        {"id": r.id, "createdAt": r.created_at.isoformat(), "severity": r.severity,
         "score": r.score, "specialty": r.specialty}
        for r in rows
    ]


@app.get("/health")
def health():
    return {"status": "UP"}
