import { Injectable } from '@angular/core';
import {
	Router,
	CanActivate,
	ActivatedRouteSnapshot,
	RouterStateSnapshot
} from '@angular/router';
import { Store } from './@core/services/store.service';

@Injectable()
export class AppModuleGuard implements CanActivate {
	constructor(private readonly router: Router, private store: Store) {}

	canActivate(
		route: ActivatedRouteSnapshot,
		state: RouterStateSnapshot
	): boolean {
		const serverConnection = Number(this.store.serverConnection);

		if (serverConnection === 0) {
			this.router.navigate(['server-down']);
			return false;
		}

		return true;
	}
}
