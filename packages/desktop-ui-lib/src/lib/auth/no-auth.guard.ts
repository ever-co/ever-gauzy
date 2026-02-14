import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { selectPersistStateInit } from '@datorama/akita';
import { combineLatest, map, Observable, take, tap } from 'rxjs';
import { Store } from '../services';

/**
 * NoAuthGuard - Protects routes that should only be accessible when NOT logged in.
 *
 * Use for routes like login, register, forgot-password, etc.
 * Redirects authenticated users to the main app.
 */
export const noAuthGuard: CanActivateFn = (route, state): Observable<boolean | UrlTree> => {
	const router = inject(Router);
	const store = inject(Store);

	return combineLatest([store.isAuthenticated$, selectPersistStateInit()]).pipe(
		take(1),
		tap(([isAuthenticated]) => {
			if (isAuthenticated) {
				console.warn(
					'[NoAuthGuard] Authenticated user attempted to access a no-auth route. Redirecting to main app.'
				);
			}
		}),
		map(([isAuthenticated]) => (isAuthenticated ? router.createUrlTree(['/time-tracker']) : true))
	);
};
