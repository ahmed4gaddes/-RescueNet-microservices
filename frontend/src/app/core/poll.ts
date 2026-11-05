import { EMPTY, Observable, catchError, switchMap, timer } from 'rxjs';

/** Interroge `source` immédiatement puis toutes les `ms` ms ; une erreur n'arrête pas le polling. */
export function poll<T>(source: () => Observable<T>, ms: number): Observable<T> {
  return timer(0, ms).pipe(switchMap(() => source().pipe(catchError(() => EMPTY))));
}
