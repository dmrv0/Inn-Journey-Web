import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { Role } from './models';

/**
 * These guards decide what to render, not what is permitted. The API enforces
 * authorization independently; a guard only spares the user a pointless trip.
 */
export const signedInGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isSignedIn()) return true;

  return router.createUrlTree(['/sign-in'], {
    queryParams: { returnUrl: state.url },
  });
};

export function roleGuard(role: Role): CanActivateFn {
  return (_route, state) => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isSignedIn()) {
      return router.createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });
    }

    return auth.hasRole(role) ? true : router.createUrlTree(['/no-access']);
  };
}

/** Keeps a signed-in user away from the sign-in and register screens. */
export const anonymousOnlyGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.isSignedIn() ? router.createUrlTree(['/']) : true;
};
