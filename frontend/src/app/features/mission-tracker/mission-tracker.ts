import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { EMPTY, catchError, of, switchMap, takeWhile, timer } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { SPECIALTY_LABEL } from '../../core/models';
import { poll } from '../../core/poll';
import { SeverityBadge, StatusBadge } from '../../shared/badges';
import { MapMarker, RescueMap } from '../../shared/map';
import { Stepper } from '../../shared/stepper';

const FINAL = ['COMPLETED', 'FAILED'];

@Component({
  selector: 'app-mission-tracker',
  imports: [RouterLink, DatePipe, DecimalPipe, SeverityBadge, StatusBadge, Stepper, RescueMap],
  templateUrl: './mission-tracker.html',
})
export class MissionTracker {
  private readonly api = inject(ApiService);

  /** Paramètre de route :id (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly notFound = signal(false);
  protected readonly specialty = SPECIALTY_LABEL;

  protected readonly mission = toSignal(
    toObservable(this.id).pipe(
      switchMap(id =>
        timer(0, 2000).pipe(
          switchMap(() => this.api.mission(id).pipe(
            catchError((e: HttpErrorResponse) => { if (e.status === 404) this.notFound.set(true); return EMPTY; }),
          )),
          takeWhile(m => !FINAL.includes(m.status), true), // s'arrête après le dernier état
        )),
    ),
  );

  protected readonly live = toSignal(
    toObservable(this.id).pipe(
      switchMap(id => poll(() => this.api.dispatchMission(id), 1500).pipe(
        takeWhile(d => d.phase !== 'DONE', true),
        catchError(() => of(undefined)),
      )),
    ),
  );

  protected readonly final = computed(() => FINAL.includes(this.mission()?.status ?? ''));

  protected readonly markers = computed<MapMarker[]>(() => {
    const m = this.mission();
    if (!m) return [];
    const out: MapMarker[] = [];
    if (m.location) out.push({ id: 'p', lat: m.location.lat, lng: m.location.lng, kind: 'patient', label: 'Patient', pulse: m.status !== 'COMPLETED' && m.status !== 'FAILED' });
    if (m.hospital?.latitude != null && m.hospital.longitude != null)
      out.push({ id: 'h', lat: m.hospital.latitude, lng: m.hospital.longitude, kind: 'hospital', label: m.hospital.name });
    const l = this.live();
    if (l?.position && m.ambulance) out.push({ id: 'a', lat: l.position.lat, lng: l.position.lng, kind: 'ambulance', label: `${m.ambulance.id} — ${l.phase}` });
    return out;
  });

  protected readonly route = computed<[number, number][]>(() => {
    const m = this.mission();
    if (!m?.location || m.hospital?.latitude == null || m.hospital.longitude == null) return [];
    return [[m.location.lat, m.location.lng], [m.hospital.latitude, m.hospital.longitude]];
  });

  protected readonly phaseLabel = computed(() => {
    const p = this.live()?.phase;
    return ({ TO_SCENE: 'En route vers le patient', TO_HOSPITAL: "En route vers l'hôpital", DONE: 'Mission terminée' } as Record<string, string>)[p ?? ''] ?? p ?? '—';
  });
}
