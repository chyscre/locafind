import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/**
 * Adds "Authorization: Bearer <token>" to every LocaFind API request, and sends the user
 * back to the login screen if the server says the login is no longer valid.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const isApi = !!auth.apiBase && req.url.startsWith(auth.apiBase);

  const request = isApi && token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((err: unknown) => {
      const isLoginCall = req.url.includes('/auth.php?action=');
      if (isApi && !isLoginCall && err instanceof HttpErrorResponse && err.status === 401 && token) {
        auth.sessionExpired();
        void router.navigate(['/login'], { queryParams: { expired: 1 } });
      }
      return throwError(() => err);
    }),
  );
};
