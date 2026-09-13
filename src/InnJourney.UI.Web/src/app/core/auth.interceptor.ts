import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, filter, switchMap, take, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from './auth.service';

/** Guards against a burst of 401s all triggering their own refresh. */
let refreshing = false;
const refreshed$ = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const request = attachToken(req, auth.accessToken);

  return next(request).pipe(
    catchError((error: unknown) => {
      const is401 = error instanceof HttpErrorResponse && error.status === 401;
      const isAuthCall = req.url.includes('/auth/');

      // A 401 from the auth endpoints themselves means the credentials are
      // wrong, not that the session expired: retrying would loop.
      if (!is401 || isAuthCall || !auth.refreshToken) {
        return throwError(() => error);
      }

      return retryAfterRefresh(req, next, auth, router);
    })
  );
};

function attachToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  if (!token) return req;

  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function retryAfterRefresh(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  router: Router
): Observable<HttpEvent<unknown>> {
  if (refreshing) {
    // Wait for the in-flight refresh, then replay with the new token.
    return refreshed$.pipe(
      filter((token): token is string => token !== null),
      take(1),
      switchMap((token) => next(attachToken(req, token)))
    );
  }

  refreshing = true;
  refreshed$.next(null);

  return auth.refresh().pipe(
    switchMap((res) => {
      refreshing = false;
      refreshed$.next(res.accessToken);
      return next(attachToken(req, res.accessToken));
    }),
    catchError((refreshError: unknown) => {
      refreshing = false;
      auth.clear();

      void router.navigate(['/sign-in'], {
        queryParams: { returnUrl: router.url, expired: true },
      });

      return throwError(() => refreshError);
    })
  );
}
