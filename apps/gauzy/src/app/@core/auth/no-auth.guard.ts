import { Injectable } from '@angular/core';
import {
	ActivatedRouteSnapshot,
	CanActivate,
	Router,
	RouterStateSnapshot
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Store } from '../services/store.service';

/**
 * Use for routes which only need to be displayed if user is NOT logged in
 */
@Injectable()
export class NoAuthGuard implements CanActivate {
	constructor(
		private readonly router: Router,
		private authService: AuthService,
		private readonly store: Store
	) {}

	async canActivate(
		route: ActivatedRouteSnapshot,
		state: RouterStateSnapshot
	) {
		if (!this.store.token) {
			// not logged in so return true
			return true;
		}

		const isAuthenticated = await this.authService.isAuthenticated();

		if (!isAuthenticated) {
			// not logged in so return true
			return true;
		}

		// logged in so redirect to dashboard
		this.router.navigate(['/pages/dashboard']);

		return false;
	}
}
