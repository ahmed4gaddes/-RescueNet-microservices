import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { poll } from '../../core/poll';

@Component({
  selector: 'app-patients',
  template: `
  <div class="page">
    <div class="page-head">
      <div><h1>Patients</h1><p>Dossiers médicaux (50 plus récents).</p></div>
      <div class="field" style="min-width:260px">
        <label class="sr-only" for="q">Rechercher</label>
        <input id="q" class="input" placeholder="Rechercher nom ou CIN…" (input)="q.set($any($event.target).value)">
      </div>
    </div>

    <div class="card">
      @if (!patients()) {
        <div class="skeleton" style="height:240px"></div>
      } @else if (shown().length === 0) {
        <div class="empty"><strong>Aucun patient</strong>Aucun dossier ne correspond.</div>
      } @else {
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Nom</th><th>CIN</th><th>Âge</th><th>Groupe</th><th>Interventions</th><th>Dossier</th></tr></thead>
            <tbody>
              @for (p of shown(); track p._id) {
                <tr class="clickable" tabindex="0" (click)="open(p._id)" (keydown.enter)="open(p._id)">
                  <td><strong>{{ p.fullName }}</strong></td>
                  <td class="mono">{{ p.nationalId ?? '—' }}</td>
                  <td>{{ p.age ?? '—' }}</td>
                  <td>{{ p.bloodType ?? '—' }}</td>
                  <td>{{ p.interventions?.length ?? 0 }}</td>
                  <td>@if (p.temporary) { <span class="badge badge-orange">Temporaire</span> } @else { <span class="badge badge-green">Complet</span> }</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  </div>`,
})
export class Patients {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly patients = toSignal(poll(() => this.api.patients(), 8000));
  protected readonly q = signal('');
  protected readonly shown = computed(() => {
    const q = this.q().trim().toLowerCase();
    return (this.patients() ?? []).filter(p =>
      !q || p.fullName?.toLowerCase().includes(q) || (p.nationalId ?? '').includes(q));
  });
  protected open(id: string): void { this.router.navigate(['/patients', id]); }
}
