import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ApiService } from '../../core/api.service';
import { poll } from '../../core/poll';
import { MapMarker, RescueMap } from '../../shared/map';

@Component({
  selector: 'app-ambulances',
  imports: [RescueMap],
  template: `
  <div class="page">
    <div class="page-head"><div><h1>Ambulances</h1><p>Flotte et positions GPS simulées — actualisation toutes les 2 s.</p></div></div>
    <section class="grid split">
      <div class="card"><app-map [markers]="markers()" [height]="460" /></div>
      <div class="card">
        @if (!ambulances()) { <div class="skeleton" style="height:300px"></div> }
        @else {
          <div class="table-wrap"><table class="table">
            <thead><tr><th>ID</th><th>Plaque</th><th>Statut</th></tr></thead>
            <tbody>
              @for (a of ambulances(); track a.id) {
                <tr><td><strong>{{ a.id }}</strong></td><td class="mono">{{ a.plate }}</td>
                  <td><span class="badge" [class]="'badge ' + (a.status === 'AVAILABLE' ? 'badge-green' : 'badge-orange')">{{ a.status === 'AVAILABLE' ? 'Disponible' : 'En mission' }}</span></td></tr>
              }
            </tbody></table></div>
        }
      </div>
    </section>
  </div>`,
})
export class Ambulances {
  private readonly api = inject(ApiService);
  protected readonly ambulances = toSignal(poll(() => this.api.ambulances(), 2000));
  protected readonly markers = computed<MapMarker[]>(() => (this.ambulances() ?? []).map(a => ({
    id: a.id, lat: a.position.lat, lng: a.position.lng, kind: 'ambulance', label: `${a.id} (${a.plate})`,
  })));
}
