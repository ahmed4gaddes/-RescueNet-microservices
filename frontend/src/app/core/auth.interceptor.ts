import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { API_URL } from './api.service';
import { AuthService } from './auth.service';

/** Ajoute « Authorization: Bearer <jwt> » aux appels vers l'API Gateway uniquement. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API_URL)) return next(req);
  const auth = inject(AuthService);
  return from(auth.token()).pipe(
    switchMap(token => next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req)),
  );
};
