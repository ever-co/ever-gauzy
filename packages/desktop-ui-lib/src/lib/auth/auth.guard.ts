import { Injectable } from '@angular/core';
import {
	ActivatedRouteSnapshot,
	CanActivate,
	Router,
	RouterStateSnapshot,
} from '@angular/router';
import { AuthService, AuthStrategy } from './services';
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
		let isAuthenticated = false;
		try {
			isAuthenticated = await this.authService.isAuthenticated();
		} catch (error) {
			console.error(error);
		}
		console.log(
			'Token Authenticated:',
			`${isAuthenticated ? 'true' : 'false'}`
		);

		if (isAuthenticated) {
			return true; // logged in so return true
		} else {
			if (!!this.store.userId) return true;
			await this.logoutAndRedirect(state.url);
			return false;
		}
	}

	private async logoutAndRedirect(returnUrl: string): Promise<void> {
		this.logoutDesktop();
		this.logoutAndClearStore();
		await this.redirectToLogin(returnUrl);
	}

	private logoutDesktop() {
		if (this.electronService.isElectron) {
			this.electronService.ipcRenderer.send('logout_desktop');
		}
	}

	private logoutAndClearStore() {
		this.authStrategy.logout();
	}

	private async redirectToLogin(returnUrl: string) {
		await this.router.navigate(['/auth/login'], {
			queryParams: { returnUrl },
		});
	}
}
