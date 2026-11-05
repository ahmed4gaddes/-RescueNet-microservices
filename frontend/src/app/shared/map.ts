import { AfterViewInit, Component, ElementRef, OnDestroy, effect, input, viewChild } from '@angular/core';
import * as L from 'leaflet';

export type MarkerKind = 'patient' | 'hospital' | 'ambulance';
export interface MapMarker { id: string; lat: number; lng: number; kind: MarkerKind; label: string; pulse?: boolean; }

const STYLE: Record<MarkerKind, { color: string; glyph: string }> = {
  patient: { color: '#e5484d', glyph: '✚' },
  hospital: { color: '#2563eb', glyph: 'H' },
  ambulance: { color: '#16a34a', glyph: '⛟' },
};

/** Enveloppe Leaflet : marqueurs (divIcon, sans fichiers image) + tracé optionnel. */
@Component({
  selector: 'app-map',
  template: `<div #host class="map" [style.height.px]="height()" role="img" aria-label="Carte des interventions"></div>`,
})
export class RescueMap implements AfterViewInit, OnDestroy {
  readonly markers = input<MapMarker[]>([]);
  /** Tracé patient → hôpital (facultatif). */
  readonly route = input<[number, number][]>([]);
  readonly height = input(420);

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private map?: L.Map;
  private layer = L.layerGroup();
  private fitted = false;

  constructor() {
    effect(() => { this.markers(); this.route(); this.draw(); });
  }

  ngAfterViewInit(): void {
    this.map = L.map(this.host().nativeElement, { zoomControl: true, attributionControl: true }).setView([36.8, 10.18], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© OpenStreetMap',
    }).addTo(this.map);
    this.layer.addTo(this.map);
    this.draw();
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  ngOnDestroy(): void { this.map?.remove(); }

  private draw(): void {
    if (!this.map) return;
    this.layer.clearLayers();
    const pts: L.LatLngExpression[] = [];
    for (const m of this.markers()) {
      const s = STYLE[m.kind];
      const icon = L.divIcon({
        className: '',
        html: `<div class="marker ${m.pulse ? 'pulse' : ''}" style="background:${s.color}">${s.glyph}</div>`,
        iconSize: [30, 30], iconAnchor: [15, 15],
      });
      L.marker([m.lat, m.lng], { icon, title: m.label, alt: m.label }).bindTooltip(m.label).addTo(this.layer);
      pts.push([m.lat, m.lng]);
    }
    const r = this.route();
    if (r.length > 1) L.polyline(r, { color: '#2563eb', weight: 4, opacity: .6, dashArray: '8 8' }).addTo(this.layer);
    if (!this.fitted && pts.length) {
      this.map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 15 });
      this.fitted = true;
    }
  }
}
