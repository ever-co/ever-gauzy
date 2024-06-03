import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { environment } from '@gauzy/ui-config';
import { Store } from '@gauzy/ui-sdk/common';

@Injectable()
export class AppModuleGuard implements CanActivate {
	constructor(private readonly router: Router, private store: Store) {}

	canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
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
