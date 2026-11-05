import { Component, computed, input } from '@angular/core';
import { MissionStatus, STATUS_LABEL } from '../core/models';

@Component({
  selector: 'app-severity',
  template: `<span class="badge" [class]="'badge ' + cls()">{{ severity() ?? '—' }}</span>`,
})
export class SeverityBadge {
  readonly severity = input<string | null | undefined>(null);
  protected readonly cls = computed(() =>
    ({ ROUGE: 'badge-red', ORANGE: 'badge-orange', VERT: 'badge-green' } as Record<string, string>)[this.severity() ?? ''] ?? 'badge-gray');
}

@Component({
  selector: 'app-status',
  template: `<span class="badge" [class]="'badge ' + cls()">{{ label() }}</span>`,
})
export class StatusBadge {
  readonly status = input.required<MissionStatus>();
  protected readonly label = computed(() => STATUS_LABEL[this.status()] ?? this.status());
  protected readonly cls = computed(() => {
    const s = this.status();
    if (s === 'COMPLETED') return 'badge-green';
    if (s === 'FAILED') return 'badge-red';
    if (s === 'ON_SCENE' || s === 'TRANSPORTING') return 'badge-orange';
    return 'badge-blue';
  });
}
