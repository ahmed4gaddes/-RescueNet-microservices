import { Routes } from '@angular/router';
import { roleGuard } from './core/role.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', title: 'Tableau de bord', loadComponent: () => import('./features/dashboard/dashboard').then(m => m.Dashboard) },
  { path: 'emergency/new', title: 'Nouvelle urgence', loadComponent: () => import('./features/emergency-form/emergency-form').then(m => m.EmergencyForm) },
  { path: 'emergency/:id', title: 'Suivi de mission', loadComponent: () => import('./features/mission-tracker/mission-tracker').then(m => m.MissionTracker) },
  { path: 'missions', title: 'Missions', loadComponent: () => import('./features/missions/missions').then(m => m.Missions) },
  { path: 'patients', title: 'Patients', loadComponent: () => import('./features/patients/patients').then(m => m.Patients) },
  { path: 'patients/:id', title: 'Dossier patient', loadComponent: () => import('./features/patient-detail/patient-detail').then(m => m.PatientDetail) },
  { path: 'hospitals', title: 'Hôpitaux', loadComponent: () => import('./features/hospitals/hospitals').then(m => m.Hospitals) },
  { path: 'ambulances', title: 'Ambulances', loadComponent: () => import('./features/ambulances/ambulances').then(m => m.Ambulances) },
  { path: 'triage', title: 'Triage IA', canActivate: [roleGuard], data: { roles: ['ADMIN'] }, loadComponent: () => import('./features/triage-history/triage-history').then(m => m.TriageHistory) },
  { path: 'forbidden', title: 'Accès refusé', loadComponent: () => import('./features/forbidden/forbidden').then(m => m.Forbidden) },
  { path: '**', redirectTo: '' },
];
