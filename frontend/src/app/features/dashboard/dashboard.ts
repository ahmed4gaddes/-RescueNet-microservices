import { DatePipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { Mission, SPECIALTY_LABEL } from '../../core/models';
import { poll } from '../../core/poll';
import { SeverityBadge, StatusBadge } from '../../shared/badges';
import { MapMarker, RescueMap } from '../../shared/map';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, DatePipe, SeverityBadge, StatusBadge, RescueMap],
  templateUrl: './dashboard.html',
})
export class Dashboard {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly missions = toSignal(poll(() => this.api.missions(), 4000));
  protected readonly ambulances = toSignal(poll(() => this.api.ambulances(), 3000));
  protected readonly hospitals = toSignal(poll(() => this.api.hospitals(), 6000));
  protected readonly specialty = SPECIALTY_LABEL;

  protected readonly active = computed(() =>
    (this.missions() ?? []).filter(m => m.status !== 'COMPLETED' && m.status !== 'FAILED').length);
  protected readonly red = computed(() =>
    (this.missions() ?? []).filter(m => m.triage?.severity === 'ROUGE' && m.status !== 'COMPLETED' && m.status !== 'FAILED').length);
  protected readonly availableAmb = computed(() => (this.ambulances() ?? []).filter(a => a.status === 'AVAILABLE').length);
  protected readonly beds = computed(() => {
    const h = this.hospitals() ?? [];
    return { free: h.reduce((s, x) => s + x.availableBeds, 0), total: h.reduce((s, x) => s + x.totalBeds, 0) };
  });
  protected readonly latest = computed(() => (this.missions() ?? []).slice(0, 6));

  protected readonly markers = computed<MapMarker[]>(() => [
    ...(this.hospitals() ?? []).map(h => ({
      id: 'h' + h.id, lat: h.latitude, lng: h.longitude, kind: 'hospital' as const,
      label: `${h.name} — ${h.availableBeds}/${h.totalBeds} lits libres`,
    })),
    ...(this.ambulances() ?? []).map(a => ({
      id: a.id, lat: a.position.lat, lng: a.position.lng, kind: 'ambulance' as const,
      label: `${a.id} (${a.plate}) — ${a.status === 'AVAILABLE' ? 'disponible' : 'en mission'}`,
    })),
  ]);

  protected open(m: Mission): void { this.router.navigate(['/emergency', m.missionId]); }
}
