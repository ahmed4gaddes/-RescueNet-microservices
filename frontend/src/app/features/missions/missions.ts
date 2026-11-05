import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { SPECIALTY_LABEL } from '../../core/models';
import { poll } from '../../core/poll';
import { SeverityBadge, StatusBadge } from '../../shared/badges';

@Component({
  selector: 'app-missions',
  imports: [RouterLink, DatePipe, DecimalPipe, SeverityBadge, StatusBadge],
  template: `
  <div class="page">
    <div class="page-head">
      <div><h1>Missions</h1><p>Les 50 dernières interventions.</p></div>
      <a class="btn btn-primary" routerLink="/emergency/new">✚ Nouvelle urgence</a>
    </div>

    <div class="row" role="group" aria-label="Filtrer par gravité">
      @for (f of filters; track f.key) {
        <button class="btn btn-sm" [class.btn-primary]="filter() === f.key" (click)="filter.set(f.key)">{{ f.label }}</button>
      }
    </div>

    <div class="card">
      @if (!missions()) {
        <div class="skeleton" style="height:240px"></div>
      } @else if (shown().length === 0) {
        <div class="empty"><strong>Aucune mission</strong>Aucun résultat pour ce filtre.</div>
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Heure</th><th>Gravité</th><th>Score</th><th>Spécialité</th><th>Hôpital</th><th>Ambulance</th><th>Statut</th></tr></thead>
            <tbody>
              @for (m of shown(); track m.missionId) {
                <tr class="clickable" tabindex="0" (click)="open(m.missionId)" (keydown.enter)="open(m.missionId)">
                  <td class="mono">{{ m.createdAt | date: 'dd/MM HH:mm:ss' }}</td>
                  <td><app-severity [severity]="m.triage?.severity" /></td>
                  <td class="mono">{{ m.triage ? (m.triage.score | number: '1.0-0') : '—' }}</td>
                  <td>{{ m.triage ? (specialty[m.triage.specialty] ?? m.triage.specialty) : '—' }}</td>
                  <td>{{ m.hospital?.name ?? '—' }}</td>
                  <td class="mono">{{ m.ambulance?.id ?? '—' }}</td>
                  <td><app-status [status]="m.status" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  </div>`,
})
export class Missions {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected readonly missions = toSignal(poll(() => this.api.missions(), 4000));
  protected readonly specialty = SPECIALTY_LABEL;
  protected readonly filter = signal<string>('ALL');
  protected readonly filters = [
    { key: 'ALL', label: 'Toutes' }, { key: 'ROUGE', label: 'Rouge' },
    { key: 'ORANGE', label: 'Orange' }, { key: 'VERT', label: 'Vert' }, { key: 'FAILED', label: 'Échecs' },
  ];
  protected readonly shown = computed(() => {
    const f = this.filter();
    return (this.missions() ?? []).filter(m =>
      f === 'ALL' || (f === 'FAILED' ? m.status === 'FAILED' : m.triage?.severity === f));
  });

  protected open(id: string): void { this.router.navigate(['/emergency', id]); }
}
