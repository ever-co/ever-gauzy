import { Injectable } from '@angular/core';
import {
	ActivatedRouteSnapshot,
	CanActivate,
	Router,
	RouterStateSnapshot
} from '@angular/router';
import { first } from 'rxjs/operators';
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
		debugger;

		const expectedPermission = route.data.expectedPermission;
		const hasPermission = await this.authService
			.hasPermission(expectedPermission)
			.pipe(first())
			.toPromise();

		if (hasPermission) {
			return true;
		}

		this.router.navigate(['/']);

		return false;
	}
}
