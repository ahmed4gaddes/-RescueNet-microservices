import { Component, computed, input } from '@angular/core';
import { MissionStatus, STATUS_STEPS } from '../core/models';

/** Frise de progression DISPATCHED → ON_SCENE → TRANSPORTING → COMPLETED. */
@Component({
  selector: 'app-stepper',
  template: `
    <ol class="steps" aria-label="Progression de la mission">
      @for (s of steps; track s.key; let i = $index) {
        <li [class.done]="i < current()" [class.now]="i === current()" [attr.aria-current]="i === current() ? 'step' : null">
          <span class="dot">{{ i < current() ? '✓' : i + 1 }}</span>
          <span class="lbl">{{ s.label }}</span>
        </li>
      }
    </ol>`,
  styles: `
    .steps { list-style: none; margin: 0; padding: 0; display: flex; gap: 0; }
    li { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; position: relative; text-align: center; color: var(--muted); font-size: .85rem; font-weight: 600; }
    li:not(:last-child)::after { content: ''; position: absolute; top: 16px; left: calc(50% + 20px); right: calc(-50% + 20px); height: 3px; background: var(--border); border-radius: 2px; }
    li.done:not(:last-child)::after { background: var(--green); }
    .dot { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; background: var(--surface-2); border: 2px solid var(--border); font-weight: 700; z-index: 1; }
    li.done .dot { background: var(--green); border-color: var(--green); color: #fff; }
    li.now { color: var(--text); }
    li.now .dot { border-color: var(--primary); color: var(--primary); box-shadow: 0 0 0 5px var(--primary-soft); }
    @media (max-width: 560px) { .lbl { font-size: .72rem; } }
  `,
})
export class Stepper {
  readonly status = input.required<MissionStatus>();
  protected readonly steps = STATUS_STEPS;
  /** Index de l'étape en cours ; COMPLETED = tout est fait. */
  protected readonly current = computed(() => {
    const s = this.status();
    if (s === 'COMPLETED') return this.steps.length;
    const i = this.steps.findIndex(x => x.key === s);
    return i < 0 ? 0 : i;
  });
}
