import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { Store } from '../services';

/**
 * NoAuthGuard - Protects routes that should only be accessible when NOT logged in.
 *
 * Use for routes like login, register, forgot-password, etc.
 * Redirects authenticated users to the main app.
 */
@Injectable()
export class NoAuthGuard implements CanActivate {
	constructor(private readonly router: Router, private readonly store: Store) {}

	async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> {
		// Check if we have stored authentication
		const hasStoredAuth = !!this.store.token && !!this.store.userId;

		if (!hasStoredAuth) {
			// No stored auth, allow access to auth pages
			return true;
		}

		// User is authenticated, redirect to app
		console.log('[NoAuthGuard] User already authenticated, redirecting to app');
		await this.router.navigate(['/time-tracker']);
		return false;
	}
}
