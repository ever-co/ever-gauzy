import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Store } from '@gauzy/ui-sdk/common';
import { AuthService, AuthStrategy, ElectronService } from '../services';

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		private readonly router: Router,
		private readonly authService: AuthService,
		private readonly authStrategy: AuthStrategy,
		private readonly store: Store,
		private readonly electronService: ElectronService
	) {}

	/**
	 * Checks if the user is authenticated before allowing navigation to a route.
	 *
	 * @param {ActivatedRouteSnapshot} route - The route to navigate to.
	 * @param {RouterStateSnapshot} state - The current state of the router.
	 * @return {Promise<boolean>} A promise that resolves to true if the user is authenticated, false otherwise.
	 */
	async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> {
		const token = route.queryParamMap.get('token');
		const userId = route.queryParamMap.get('userId');

		if (token && userId) {
			this.store.token = token;
			this.store.userId = userId;
		}

		if (await this.authService.isAuthenticated()) {
			// Logged in, so allow navigation
			return true;
		}

		// Not logged in, handle the logout process
		await this.handleLogout(state.url);
		return false;
	}

	/**
	 * Handles the logout process and redirects to the login page.
	 *
	 * @param {string} returnUrl - The URL to return to after logging in.
	 */
	private async handleLogout(returnUrl: string): Promise<void> {
		if (this.electronService.isElectron) {
			try {
				this.electronService.ipcRenderer.send('logout');
			} catch (error) {
				console.error('Error sending logout message to Electron:', error);
			}
		}

		await firstValueFrom(this.authStrategy.logout());
		await this.router.navigate(['/auth/login'], { queryParams: { returnUrl } });
	}
}
