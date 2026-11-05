import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../../core/api.service';
import { SPECIALTY_LABEL } from '../../core/models';
import { poll } from '../../core/poll';
import { MapMarker, RescueMap } from '../../shared/map';

@Component({
  selector: 'app-hospitals',
  imports: [RescueMap],
  template: `
  <div class="page">
    <div class="page-head"><div><h1>Hôpitaux</h1><p>Capacité en lits et spécialités disponibles.</p></div></div>

    @if (!hospitals()) {
      <div class="grid cols-3"><div class="skeleton" style="height:170px"></div><div class="skeleton" style="height:170px"></div><div class="skeleton" style="height:170px"></div></div>
    } @else {
      <section class="grid cols-3">
        @for (h of hospitals(); track h.id) {
          <article class="card">
            <div class="card-head"><div><h2>{{ h.name }}</h2><span class="muted">{{ h.city }}</span></div>
              <span class="badge" [class]="'badge ' + level(h.availableBeds, h.totalBeds)">{{ h.availableBeds }} libres</span></div>
            <div class="bar" role="img" [attr.aria-label]="h.availableBeds + ' lits libres sur ' + h.totalBeds">
              <span [style.width.%]="occupancy(h.availableBeds, h.totalBeds)" [class]="level(h.availableBeds, h.totalBeds)"></span>
            </div>
            <p class="muted" style="margin:6px 0 12px">{{ h.totalBeds - h.availableBeds }} occupés sur {{ h.totalBeds }}</p>
            <div class="row">
              @for (s of specs(h.specialties); track s) { <span class="chip">{{ label[s] ?? s }}</span> }
            </div>
          </article>
        }
      </section>
      <div class="card"><div class="card-head"><h2>Localisation</h2></div><app-map [markers]="markers()" [height]="380" /></div>
    }
  </div>`,
  styles: `
    .bar { height: 10px; border-radius: 6px; background: var(--surface-2); overflow: hidden; }
    .bar span { display: block; height: 100%; border-radius: 6px; }
    .bar span.badge-green { background: var(--green); } .bar span.badge-orange { background: var(--orange); } .bar span.badge-red { background: var(--red); }
    .bar span::before { display: none; }
  `,
})
export class Hospitals {
  private readonly api = inject(ApiService);
  protected readonly hospitals = toSignal(poll(() => this.api.hospitals(), 5000));
  protected readonly label = SPECIALTY_LABEL;
  protected readonly markers = computed<MapMarker[]>(() => (this.hospitals() ?? []).map(h => ({
    id: 'h' + h.id, lat: h.latitude, lng: h.longitude, kind: 'hospital', label: `${h.name} — ${h.availableBeds}/${h.totalBeds}`,
  })));
  protected specs(s: string): string[] { return s.split(',').map(x => x.trim()).filter(Boolean); }
  protected occupancy(free: number, total: number): number { return total ? Math.round(((total - free) / total) * 100) : 0; }
  protected level(free: number, total: number): string {
    const r = total ? free / total : 0;
    return r > 0.4 ? 'badge-green' : r > 0.15 ? 'badge-orange' : 'badge-red';
  }
}
