import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../../core/api.service';
import { SPECIALTY_LABEL } from '../../core/models';
import { poll } from '../../core/poll';
import { SeverityBadge } from '../../shared/badges';

@Component({
  selector: 'app-triage-history',
  imports: [DatePipe, DecimalPipe, SeverityBadge],
  template: `
  <div class="page">
    <div class="page-head"><div><h1>Triage IA</h1><p>Décisions du modèle (RandomForest) — jeu de données synthétique, démonstration uniquement.</p></div></div>

    <section class="grid cols-3">
      @for (s of dist(); track s.key) {
        <div class="card kpi" [style.--accent]="s.color">
          <span class="label">{{ s.key }}</span>
          <span class="value">{{ s.count }}</span>
          <span class="hint">{{ s.pct | number: '1.0-0' }} % des triages</span>
        </div>
      }
    </section>

    <div class="card">
      @if (!history()) { <div class="skeleton" style="height:240px"></div> }
      @else if (history()!.length === 0) { <div class="empty"><strong>Aucun triage</strong>Lancez une urgence pour alimenter l'historique.</div> }
      @else {
        <div class="table-wrap"><table class="table">
          <thead><tr><th>#</th><th>Heure</th><th>Gravité</th><th>Score</th><th>Spécialité</th></tr></thead>
          <tbody>
            @for (h of history(); track h.id) {
              <tr><td class="mono">{{ h.id }}</td><td class="mono">{{ h.createdAt | date: 'dd/MM HH:mm:ss' }}</td>
                <td><app-severity [severity]="h.severity" /></td><td class="mono">{{ h.score | number: '1.0-1' }}</td>
                <td>{{ specialty[h.specialty] ?? h.specialty }}</td></tr>
            }
          </tbody></table></div>
      }
    </div>
  </div>`,
})
export class TriageHistory {
  private readonly api = inject(ApiService);
  protected readonly history = toSignal(poll(() => this.api.triageHistory(), 6000));
  protected readonly specialty = SPECIALTY_LABEL;
  protected readonly dist = computed(() => {
    const h = this.history() ?? [];
    return [['ROUGE', 'var(--red)'], ['ORANGE', 'var(--orange)'], ['VERT', 'var(--green)']].map(([key, color]) => {
      const count = h.filter(x => x.severity === key).length;
      return { key, color, count, pct: h.length ? (count / h.length) * 100 : 0 };
    });
  });
}
