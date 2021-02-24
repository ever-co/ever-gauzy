import { Injectable } from '@angular/core';
import {
	ActivatedRouteSnapshot,
	CanActivate,
	Router,
	RouterStateSnapshot
} from '@angular/router';
import { AuthService } from './services/auth.service';
import { ElectronService } from 'ngx-electron';

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		private readonly router: Router,
		private authService: AuthService,
		private electronService: ElectronService
	) {}

	async canActivate(
		route: ActivatedRouteSnapshot,
		state: RouterStateSnapshot
	) {
		const isAuthenticated = await this.authService.isAuthenticated();

		if (isAuthenticated) {
			// logged in so return true
			return true;
		}

		// not logged in so redirect to login page with the return url
		if (this.electronService.isElectronApp) {
			try {
				this.electronService.ipcRenderer.send('logout');
			} catch (error) {}
		}
		this.router.navigate(['/auth/login'], {
			queryParams: { returnUrl: state.url }
		});

		return false;
	}
}
