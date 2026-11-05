import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Ambulance, DispatchMission, EmergencyRequest, Hospital, Mission, Patient, TriageRecord,
} from './models';

/** Tout passe par l'API Gateway (CORS déjà ouvert côté backend). */
export const API_URL = 'http://localhost:8080';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  // emergency-service
  createEmergency(body: EmergencyRequest): Observable<Mission> {
    return this.http.post<Mission>(`${API_URL}/api/emergencies`, body);
  }
  missions(): Observable<Mission[]> {
    return this.http.get<Mission[]>(`${API_URL}/api/emergencies`);
  }
  mission(id: string): Observable<Mission> {
    return this.http.get<Mission>(`${API_URL}/api/emergencies/${id}`);
  }

  // dispatch-service
  ambulances(): Observable<Ambulance[]> {
    return this.http.get<Ambulance[]>(`${API_URL}/api/dispatch/ambulances`);
  }
  dispatchMission(id: string): Observable<DispatchMission> {
    return this.http.get<DispatchMission>(`${API_URL}/api/dispatch/missions/${id}`);
  }

  // hospital-service
  hospitals(): Observable<Hospital[]> {
    return this.http.get<Hospital[]>(`${API_URL}/api/hospitals`);
  }

  // patient-record-service
  patients(): Observable<Patient[]> {
    return this.http.get<Patient[]>(`${API_URL}/api/patients`);
  }
  patient(id: string): Observable<Patient> {
    return this.http.get<Patient>(`${API_URL}/api/patients/${id}`);
  }
  patientByNationalId(nid: string): Observable<Patient> {
    return this.http.get<Patient>(`${API_URL}/api/patients/national/${encodeURIComponent(nid)}`);
  }
  updatePatient(id: string, body: Partial<Patient>): Observable<Patient> {
    return this.http.put<Patient>(`${API_URL}/api/patients/${id}`, body);
  }
  createPatient(body: Partial<Patient>): Observable<Patient> {
    return this.http.post<Patient>(`${API_URL}/api/patients`, body);
  }

  // triage-ai-service
  triageHistory(): Observable<TriageRecord[]> {
    return this.http.get<TriageRecord[]>(`${API_URL}/api/triage/history`);
  }
}
