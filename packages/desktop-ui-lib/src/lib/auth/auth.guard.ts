import { Injectable } from '@angular/core';
import {
	ActivatedRouteSnapshot,
	CanActivate,
	Router,
	RouterStateSnapshot,
} from '@angular/router';
import { AuthService } from './services/auth.service';
import { AuthStrategy } from './services/auth-strategy.service';
import { Store } from '../services';
import { ElectronService } from '../electron/services';

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		private readonly router: Router,
		private readonly authService: AuthService,
		private readonly electronService: ElectronService,
		private readonly authStrategy: AuthStrategy,
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

			// not logged in so logout from desktop timer
			if (this.electronService.isElectron) {
				try {
					this.electronService.ipcRenderer.send('logout');
				} catch (error) { }
			}

			// logout and clear local store
			this.authStrategy.logout();

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
