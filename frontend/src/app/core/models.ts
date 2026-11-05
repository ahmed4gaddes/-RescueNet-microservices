export type Severity = 'ROUGE' | 'ORANGE' | 'VERT';
export type MissionStatus =
  | 'RECEIVED' | 'TRIAGED' | 'BED_RESERVED' | 'DISPATCHED'
  | 'ON_SCENE' | 'TRANSPORTING' | 'COMPLETED' | 'FAILED';

export interface LatLng { lat: number; lng: number; }

export interface Mission {
  missionId: string;
  status: MissionStatus;
  patientId: string | null;
  symptoms: string[];
  triage: { severity: Severity; score: number; specialty: string; explanation: string } | null;
  hospital: { id: number; name: string; reservationId: string; latitude: number | null; longitude: number | null } | null;
  ambulance: { id: string; etaMinutes: number } | null;
  location: LatLng | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmergencyRequest {
  callerPhone: string;
  nationalId: string;
  age: number;
  location: LatLng;
  symptoms: string[];
  vitals: { heartRate: number; spo2: number; systolicBP: number; consciousness: string; painLevel: number };
}

export interface Ambulance {
  id: string;
  plate: string;
  status: string;
  position: LatLng;
}

export interface DispatchMission {
  ambulanceId: string;
  etaMinutes: number;
  missionId: string;
  phase: string;
  position: LatLng;
  remainingKm: number;
}

export interface Hospital {
  id: number;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  specialties: string;
  totalBeds: number;
  availableBeds: number;
}

export interface Intervention {
  missionId: string;
  severity: string;
  hospitalName: string;
  symptoms: string[];
  date: string;
}

export interface Patient {
  _id: string;
  nationalId?: string;
  fullName: string;
  age?: number;
  gender?: string;
  bloodType?: string;
  allergies?: string[];
  chronicConditions?: string[];
  medications?: string[];
  emergencyContact?: { name?: string; phone?: string };
  temporary?: boolean;
  interventions?: Intervention[];
  createdAt?: string;
}

export interface TriageRecord {
  id: number;
  createdAt: string;
  severity: Severity;
  score: number;
  specialty: string;
}

export const STATUS_STEPS: { key: MissionStatus; label: string }[] = [
  { key: 'DISPATCHED', label: 'Ambulance envoyée' },
  { key: 'ON_SCENE', label: 'Sur place' },
  { key: 'TRANSPORTING', label: 'Transport' },
  { key: 'COMPLETED', label: 'Admis' },
];

export const STATUS_LABEL: Record<MissionStatus, string> = {
  RECEIVED: 'Reçue',
  TRIAGED: 'Triée',
  BED_RESERVED: 'Lit réservé',
  DISPATCHED: 'Ambulance envoyée',
  ON_SCENE: 'Sur place',
  TRANSPORTING: 'En transport',
  COMPLETED: 'Terminée',
  FAILED: 'Échec',
};

export const SPECIALTY_LABEL: Record<string, string> = {
  CARDIOLOGY: 'Cardiologie',
  TRAUMA: 'Traumatologie',
  NEUROLOGY: 'Neurologie',
  PULMONOLOGY: 'Pneumologie',
  GENERAL: 'Urgences générales',
  PEDIATRICS: 'Pédiatrie',
};
