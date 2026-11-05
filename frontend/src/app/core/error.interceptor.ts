import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from './toast.service';

/** Transforme les erreurs HTTP en message lisible. Les 404 sont laissés aux écrans (ex. patient inconnu). */
export function messageOf(e: HttpErrorResponse): string {
  if (e.status === 0) return 'API Gateway injoignable (http://localhost:8080). Les services sont-ils démarrés ?';
  const body = e.error;
  if (body && typeof body === 'object' && body.error) return String(body.error);
  if (e.status === 401) return 'Session expirée : reconnectez-vous.';
  if (e.status === 403) return "Accès refusé : votre rôle ne permet pas cette action.";
  if (e.status === 503) return 'Service indispensable indisponible.';
  return `Erreur ${e.status}`;
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((e: HttpErrorResponse) => {
      if (e.status !== 404 && !req.headers.has('X-Silent')) toast.error(messageOf(e));
      return throwError(() => e);
    }),
  );
};
