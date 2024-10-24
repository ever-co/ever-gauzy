import { Injectable } from '@angular/core';
import { Router, ActivatedRouteSnapshot } from '@angular/router';
import { environment } from '@gauzy/ui-config';
import { Store } from '@gauzy/ui-core/core';

@Injectable()
export class AppModuleGuard {
	constructor(private readonly router: Router, private readonly store: Store) {}

	/**
	 * Checks if the user can activate the route.
	 *
	 * @param {ActivatedRouteSnapshot} route - The route being activated.
	 * @return {boolean} Returns true if the user can activate the route, false otherwise.
	 */
	canActivate(route: ActivatedRouteSnapshot): boolean {
		const serverConnection = Number(this.store.serverConnection);

		if (serverConnection === 0) {
			if (environment.IS_ELECTRON && environment.IS_INTEGRATED_DESKTOP) {
				return true;
			} else {
				this.router.navigate(['server-down']);
				return false;
			}
		}

		return true;
	}
}
