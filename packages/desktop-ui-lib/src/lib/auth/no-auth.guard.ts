import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Store } from '../services';

/**
 * NoAuthGuard - Protects routes that should only be accessible when NOT logged in.
 *
 * Use for routes like login, register, forgot-password, etc.
 * Redirects authenticated users to the main app.
 */
export const noAuthGuard: CanActivateFn = async (route, state): Promise<boolean> => {
	const router = inject(Router);
	const store = inject(Store);

	// Check if we have stored authentication
	const hasStoredAuth = !!store.token && !!store.userId;

	if (!hasStoredAuth) {
		// No stored auth, allow access to auth pages
		return true;
	}

	// User is authenticated, redirect to app
	console.log('[NoAuthGuard] User already authenticated, redirecting to app');
	await router.navigate(['/time-tracker']);
	return false;
};
