import { Injectable, signal } from '@angular/core';

export interface Toast { id: number; kind: 'error' | 'success' | 'info'; text: string; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(kind: Toast['kind'], text: string, ms = 5000): void {
    // évite l'empilement quand un polling échoue en boucle
    if (this.toasts().some(t => t.text === text)) return;
    const id = ++this.seq;
    this.toasts.update(t => [...t, { id, kind, text }]);
    setTimeout(() => this.dismiss(id), ms);
  }
  error(text: string): void { this.show('error', text, 7000); }
  success(text: string): void { this.show('success', text); }
  dismiss(id: number): void { this.toasts.update(t => t.filter(x => x.id !== id)); }
}
