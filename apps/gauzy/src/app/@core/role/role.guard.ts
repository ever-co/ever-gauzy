import { Injectable } from '@angular/core';
import {
	ActivatedRouteSnapshot,
	CanActivate,
	Router,
	RouterStateSnapshot
} from '@angular/router';
import { AuthService } from '../services/auth.service';
import { first } from 'rxjs/operators';

@Injectable()
export class RoleGuard implements CanActivate {
	constructor(
		private readonly router: Router,
		private readonly authService: AuthService
	) {}

	async canActivate(
		route: ActivatedRouteSnapshot,
		state: RouterStateSnapshot
	) {
		const expectedRole = route.data.expectedRole;
		const hasRole = await this.authService
			.hasRole(expectedRole)
			.pipe(first())
			.toPromise();

		// TODO remove but for now it will be useful for debugging before I've finish the authorization issue. https://github.com/ever-co/gauzy/issues/177
		console.warn('RoleGuard');
		console.warn('expectedRole');
		console.warn(expectedRole);
		console.warn('hasRole');
		console.warn(hasRole);

		if (hasRole) {
			return true;
		}

		this.router.navigate(['/auth/login'], {
			queryParams: { returnUrl: state.url }
		});

		return false;
	}
}
