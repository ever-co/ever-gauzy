import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { selectPersistStateInit } from '@datorama/akita';
import { combineLatest, map, Observable, take } from 'rxjs';
import { Store } from './../services/store.service';

/**
 * AuthGuard
 *
 * Responsibilities:
 * - Determine whether the user is authenticated
 * - Redirect unauthenticated users to login
 *
 * Non-responsibilities:
 * - Token validation
 * - Token refresh
 * - Network calls
 */
export const authGuard: CanActivateFn = (route, state): Observable<boolean | UrlTree> => {
	const router = inject(Router);
	const store = inject(Store);

	return combineLatest([store.isAuthenticated$, selectPersistStateInit()]).pipe(
		take(1),
		map(([isAuthenticated]) => (isAuthenticated ? true : buildLoginRedirect(router, state.url)))
	);
};

function buildLoginRedirect(router: Router, returnUrl: string): UrlTree {
	return router.createUrlTree(['/auth/login'], {
		queryParams: shouldPreserveReturnUrl(returnUrl) ? { returnUrl } : undefined
	});
}

function shouldPreserveReturnUrl(url: string): boolean {
	// Only preserve returnUrl if it's a protected route (not auth or public routes)
	return Boolean(url) && url !== '/' && !url.startsWith('/auth');
}
