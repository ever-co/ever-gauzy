import { Injectable } from '@angular/core';
import {
	ActivatedRouteSnapshot,
	CanActivate,
	Router,
	RouterStateSnapshot,
} from '@angular/router';
import { Store } from '../services';
import { AuthService } from './services';

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
		let isAuthenticated = false;
		try {
			isAuthenticated = await this.authService.isAuthenticated();
		} catch (error) {
			console.error(error);
		}
		if (!this.store.token || !isAuthenticated) {
			return true;
		}
		await this.router.navigate(['/time-tracker']);
		return false;
	}
}
