"""Vecteur de caractéristiques partagé entre l'entraînement et l'inférence."""

SYMPTOM_FLAGS = [
    "chest_pain",
    "breathing_difficulty",
    "stroke_signs",
    "severe_bleeding",
    "trauma",
    "abdominal_pain",
    "fever",
    "seizure",
    "cardiac_arrest",
]

FEATURES = ["age", "heartRate", "spo2", "systolicBP", "consciousness", "painLevel", *SYMPTOM_FLAGS]

CONSCIOUSNESS = {"ALERT": 0, "VOICE": 1, "PAIN": 2, "UNRESPONSIVE": 3}

# Mots-clés libres (FR/EN) -> drapeau de symptôme
KEYWORDS = {
    "chest_pain": ["chest", "thorac", "poitrine", "douleur thoracique", "cardiaque", "infarct"],
    "breathing_difficulty": ["breath", "respir", "suffoc", "dyspn", "essouffl", "asthm"],
    "stroke_signs": ["stroke", "avc", "paralys", "speech", "parole", "face droop", "visage"],
    "severe_bleeding": ["bleed", "hemorr", "hémorr", "saign", "blood loss"],
    "trauma": ["accident", "fall", "chute", "fracture", "trauma", "collision", "blessure", "burn", "brûl"],
    "abdominal_pain": ["abdom", "ventre", "stomach", "appendic"],
    "fever": ["fever", "fièvre", "fievre"],
    "seizure": ["seizure", "convuls", "épilep", "epilep"],
    "cardiac_arrest": ["cardiac arrest", "arrêt cardiaque", "arret cardiaque", "no pulse", "pas de pouls"],
}

# Spécialité requise, par ordre de priorité
SPECIALTY_RULES = [
    ("cardiac_arrest", "CARDIOLOGY"),
    ("chest_pain", "CARDIOLOGY"),
    ("stroke_signs", "NEUROLOGY"),
    ("seizure", "NEUROLOGY"),
    ("severe_bleeding", "TRAUMA"),
    ("trauma", "TRAUMA"),
    ("breathing_difficulty", "PULMONOLOGY"),
]
