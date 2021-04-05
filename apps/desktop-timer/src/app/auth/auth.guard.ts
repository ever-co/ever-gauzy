import { Injectable } from '@angular/core';
import {
	ActivatedRouteSnapshot,
	CanActivate,
	Router,
	RouterStateSnapshot
} from '@angular/router';
import { AuthService } from './services/auth.service';
import { AuthStrategy } from './auth-strategy.service';
import { ElectronService } from 'ngx-electron';

@Injectable()
export class AuthGuard implements CanActivate {
	
	constructor(
		private readonly router: Router,
		private readonly authService: AuthService,
		private readonly electronService: ElectronService,
		private readonly authStrategy: AuthStrategy,
	) {}

	async canActivate(
		route: ActivatedRouteSnapshot,
		state: RouterStateSnapshot
	) {
		const isAuthenticated = await this.authService.isAuthenticated();
		console.log('Token Authenticated:', `${isAuthenticated ? 'true' : 'false' }`);
		if (isAuthenticated) {
			// logged in so return true
			return true;
		}

		// not logged in so logout from desktop timer
		if (this.electronService.isElectronApp) {
			try {
				this.electronService.ipcRenderer.send('logout');
			} catch (error) {}
		}

		// logout and clear local store
        this.authStrategy.logout();
		
		// not logged in so redirect to login page with the return url
		this.router.navigate(['/auth/login'], {
			queryParams: { returnUrl: state.url }
		});
		return false;
	}
}
