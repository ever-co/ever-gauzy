import { Injectable } from '@angular/core';
import {
	ActivatedRouteSnapshot,
	CanActivate,
	Router,
	RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from './services/auth.service';
import { Store } from '../services';

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		private readonly router: Router,
		private readonly authService: AuthService,
		private readonly store: Store
	) {}

	async canActivate(
		route: ActivatedRouteSnapshot,
		state: RouterStateSnapshot
	) {
		try {
			const isAuthenticated = await this.authService.isAuthenticated();
			console.log(
				'Token Authenticated:',
				`${isAuthenticated ? 'true' : 'false'}`
			);
			if (isAuthenticated) {
				// logged in so return true
				return true;
			}

			// not logged in so redirect to login page with the return url
			this.router.navigate(['/auth/login'], {
				queryParams: { returnUrl: state.url },
			});
			return false;
		} catch (error) {
			if (this.store.userId) {
				return true;
			}
			return false;
		}
	}
}
