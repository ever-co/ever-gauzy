import { Injectable } from '@angular/core';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Store } from '@gauzy/desktop-ui-lib';

@Injectable()
export class AppModuleGuard {
	constructor(private readonly router: Router, private store: Store) {}

	/**
	 * Determines if the route can be activated based on the server connection status and user authentication.
	 *
	 * @param {ActivatedRouteSnapshot} route - The activated route snapshot.
	 * @param {RouterStateSnapshot} state - The router state snapshot.
	 * @returns {boolean} True if the route can be activated, false otherwise.
	 */
	canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
		const serverConnection = Number(this.store.serverConnection);
		const isUserAuthenticated = !!this.store.userId;

		if (serverConnection === 0 && !isUserAuthenticated) {
			this.router.navigate(['server-down']);
			return false;
		}

		return true;
	}
}
