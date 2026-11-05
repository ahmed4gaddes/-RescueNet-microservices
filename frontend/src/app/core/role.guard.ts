import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, Role } from './auth.service';

/** Autorise la route si l'utilisateur a au moins un des rôles listés dans `data.roles`. */
export const roleGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = (route.data['roles'] ?? []) as Role[];
  return roles.length === 0 || auth.has(...roles) ? true : router.createUrlTree(['/forbidden']);
};
