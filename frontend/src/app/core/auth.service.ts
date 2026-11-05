import { Injectable, computed, signal } from '@angular/core';
import Keycloak from 'keycloak-js';

export type Role = 'OPERATEUR' | 'ADMIN';

export const KEYCLOAK = { url: 'http://localhost:8180', realm: 'rescuenet', clientId: 'rescuenet-frontend' };

/** Connexion via Keycloak (OpenID Connect, code + PKCE). Le JWT est ajouté aux appels API par l'intercepteur. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly kc = new Keycloak(KEYCLOAK);
  private readonly _roles = signal<string[]>([]);
  private readonly _name = signal('');

  readonly roles = this._roles.asReadonly();
  readonly name = this._name.asReadonly();
  readonly isAdmin = computed(() => this._roles().includes('ADMIN'));
  readonly label = computed(() => (this.isAdmin() ? 'Administrateur' : 'Opérateur'));

  /** Appelé au démarrage : redirige vers la page de connexion Keycloak si besoin. */
  async init(): Promise<void> {
    const ok = await this.kc.init({ onLoad: 'login-required', pkceMethod: 'S256', checkLoginIframe: false });
    if (!ok) { await this.kc.login(); return; }
    this.refreshClaims();
    this.kc.onTokenExpired = () => { this.kc.updateToken(30).then(() => this.refreshClaims()).catch(() => this.kc.login()); };
  }

  private refreshClaims(): void {
    const t = this.kc.tokenParsed as { realm_access?: { roles?: string[] }; name?: string; preferred_username?: string } | undefined;
    this._roles.set(t?.realm_access?.roles ?? []);
    this._name.set(t?.name || t?.preferred_username || '');
  }

  has(...roles: Role[]): boolean { return roles.some(r => this._roles().includes(r)); }

  /** Jeton valide (renouvelé s'il expire dans moins de 30 s). */
  async token(): Promise<string | undefined> {
    try { await this.kc.updateToken(30); } catch { await this.kc.login(); }
    return this.kc.token;
  }

  logout(): Promise<void> { return this.kc.logout({ redirectUri: window.location.origin }); }
}
