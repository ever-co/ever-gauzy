import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { Store } from '@gauzy/ui-sdk/common';
import { AuthService } from '../services';
/**
 * Use for routes which only need to be displayed if user is NOT logged in
 */
@Injectable()
export class NoAuthGuard implements CanActivate {
	constructor(
		private readonly router: Router,
		private readonly authService: AuthService,
		private readonly store: Store
	) {}

	/**
	 * Checks if the user is authenticated before allowing navigation to a route.
	 *
	 * @param {ActivatedRouteSnapshot} route - The route to navigate to.
	 * @param {RouterStateSnapshot} state - The current state of the router.
	 * @return {Promise<boolean>} A promise that resolves to true if the user is authenticated, false otherwise.
	 */
	async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> {
		if (!this.store.token) {
			// not logged in so return true
			return true;
		}

		if (!(await this.authService.isAuthenticated())) {
			// not logged in so return true
			return true;
		}

		// logged in so redirect to dashboard
		this.router.navigate(['/pages/dashboard']);

		return false;
	}
}
