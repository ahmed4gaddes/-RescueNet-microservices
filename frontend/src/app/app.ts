import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';
import { ToastService } from './core/toast.service';

interface NavItem { path: string; label: string; icon: string; exact?: boolean; adminOnly?: boolean; }

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);
  protected readonly menuOpen = signal(false);
  protected readonly theme = signal<'light' | 'dark' | 'auto'>(this.loadTheme());

  protected readonly allNav: NavItem[] = [
    { path: '/', label: 'Tableau de bord', icon: '▦', exact: true },
    { path: '/emergency/new', label: 'Nouvelle urgence', icon: '✚' },
    { path: '/missions', label: 'Missions', icon: '☰' },
    { path: '/patients', label: 'Patients', icon: '☺' },
    { path: '/hospitals', label: 'Hôpitaux', icon: '⛨' },
    { path: '/ambulances', label: 'Ambulances', icon: '⛟' },
    { path: '/triage', label: 'Triage IA', icon: '◈', adminOnly: true },
  ];

  protected readonly nav = computed(() => this.allNav.filter(i => !i.adminOnly || this.auth.isAdmin()));

  private loadTheme(): 'light' | 'dark' | 'auto' {
    try {
      const t = localStorage.getItem('rescuenet-theme');
      if (t === 'light' || t === 'dark') { document.documentElement.dataset['theme'] = t; return t; }
    } catch { /* stockage indisponible */ }
    return 'auto';
  }

  protected toggleTheme(): void {
    const dark = document.documentElement.dataset['theme'] === 'dark'
      || (this.theme() === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset['theme'] = next;
    this.theme.set(next);
    try { localStorage.setItem('rescuenet-theme', next); } catch { /* ignoré */ }
  }
}
