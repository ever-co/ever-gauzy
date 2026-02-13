import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { Store } from '../services';

/**
 * AuthGuard - Protects routes that require authentication.
 *
 * Responsibilities:
 * - Check if user has valid authentication tokens
 * - Redirect to login if not authenticated
 * - Delegate token refresh to interceptors (not guards)
 *
 * This guard is lightweight and fast - it only checks stored state.
 * Token validation and refresh are handled by HTTP interceptors.
 */
@Injectable()
export class AuthGuard implements CanActivate {
	constructor(private readonly router: Router, private readonly store: Store) {}

	async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> {
		// Check if we have basic auth data
		const hasStoredAuth = !!this.store.token && !!this.store.userId;

		// In offline mode, allow access if we have stored auth
		if (this.store.isOffline) {
			console.log('[AuthGuard] Offline mode, allowing access with stored auth');
			return true;
		}

		if (!hasStoredAuth) {
			// No stored auth, redirect to login
			console.log('[AuthGuard] No authentication found, redirecting to login');
			await this.redirectToLogin(state.url);
			return false;
		}

		// User has tokens - allow access
		// Token validation and refresh will be handled by interceptors
		return true;
	}

	private async redirectToLogin(returnUrl: string): Promise<void> {
		// Don't preserve auth routes as return URL
		const shouldPreserveUrl = returnUrl && !returnUrl.startsWith('/auth') && returnUrl !== '/';

		await this.router.navigate(['/auth/login'], {
			queryParams: shouldPreserveUrl ? { returnUrl } : {}
		});
	}
}
