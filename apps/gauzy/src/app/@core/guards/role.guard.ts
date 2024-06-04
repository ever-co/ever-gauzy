import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '@gauzy/ui-sdk/core';

@Injectable()
export class RoleGuard implements CanActivate {
	constructor(private readonly router: Router, private readonly authService: AuthService) {}

	/**
	 * Asynchronously checks if the user has the expected role to activate a route.
	 *
	 * @param {ActivatedRouteSnapshot} route - The route to be activated.
	 * @param {RouterStateSnapshot} state - The current router state.
	 * @return {Promise<boolean>} A promise that resolves to true if the user has the expected role,
	 *                           false otherwise. If the user does not have the expected role, they are
	 *                           redirected to the login page with the current URL as the return URL.
	 */
	async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot) {
		const expectedRole = route.data.expectedRole;
		const hasRole = await firstValueFrom(this.authService.hasRole(expectedRole));
		if (hasRole) {
			return true;
		}

		this.router.navigate(['/auth/login'], {
			queryParams: { returnUrl: state.url }
		});
		return false;
	}
}
