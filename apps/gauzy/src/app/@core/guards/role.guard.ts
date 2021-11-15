import { Injectable } from '@angular/core';
import {
	ActivatedRouteSnapshot,
	CanActivate,
	Router,
	RouterStateSnapshot
} from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';

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
		const hasRole = await firstValueFrom(
			this.authService.hasRole(expectedRole)
		);
		if (hasRole) {
			return true;
		}

		this.router.navigate(['/auth/login'], {
			queryParams: { returnUrl: state.url }
		});
		return false;
	}
}
