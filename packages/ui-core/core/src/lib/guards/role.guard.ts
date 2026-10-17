import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services';
import { LOGIN_URL, loginReturnUrl } from '../auth/login-return-url';

@Injectable()
export class RoleGuard implements CanActivate {
	constructor(private readonly router: Router, private readonly authService: AuthService) {}

	/**
	 * Asynchronously checks if the user has the expected role to activate a route.
	 *
	 * @param {ActivatedRouteSnapshot} route - The route to be activated.
	 * @param {RouterStateSnapshot} state - The current router state.
	 * @return {Promise<boolean>} A promise that resolves to true if the user has the expected role, false otherwise.
	 */
	async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> {
		const expectedRole = route.data['expectedRole'];
		const hasRole = await firstValueFrom(this.authService.hasRole(expectedRole));
		if (hasRole) {
			return true;
		}

		const returnUrl = loginReturnUrl(state.url);

		this.router.navigate([LOGIN_URL], returnUrl ? { queryParams: { returnUrl } } : {});
		return false;
	}
}
