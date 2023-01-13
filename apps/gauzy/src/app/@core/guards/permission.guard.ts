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
export class PermissionGuard implements CanActivate {
	constructor(
		private readonly router: Router,
		private readonly authService: AuthService
	) {}

	async canActivate(
		route: ActivatedRouteSnapshot,
		state: RouterStateSnapshot
	) {
		const expectedPermissions = route.data.expectedPermissions;
		const hasPermission = await firstValueFrom(
			this.authService.hasPermissions(expectedPermissions)
		);
		if (hasPermission) {
			return true;
		}
		this.router.navigate(['/']);
		return false;
	}
}
