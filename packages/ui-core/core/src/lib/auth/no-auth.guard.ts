import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { ROUTES } from '@gauzy/ui-core/common';
import { AuthService, Store } from '../services';

/**
 * Use for routes which only need to be displayed if user is NOT logged in
 */
@Injectable()
export class NoAuthGuard {
	constructor(
		private readonly _router: Router,
		private readonly _authService: AuthService,
		private readonly _store: Store
	) {}

	/**
	 * Checks if the user is authenticated before allowing navigation to a route.
	 *
	 * @param {ActivatedRouteSnapshot} route - The route to navigate to.
	 * @param {RouterStateSnapshot} state - The current state of the router.
	 * @return {Promise<boolean>} A promise that resolves to true if the user is authenticated, false otherwise.
	 */
	async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> {
		if (!this._store.token) {
			// not logged in so return true
			return true;
		}

		if (!(await this._authService.isAuthenticated())) {
			// not logged in so return true
			return true;
		}

		// logged in so redirect to dashboard
		this._router.navigate([ROUTES.DASHBOARD]);

		return false;
	}
}
