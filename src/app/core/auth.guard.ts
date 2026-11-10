import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Logged-in users and guests may use the app; everyone else sees the login screen first. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.loggedIn() || auth.guest() ? true : inject(Router).parseUrl('/login');
};
