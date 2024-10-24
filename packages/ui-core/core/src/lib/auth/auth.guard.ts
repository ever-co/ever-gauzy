import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService, AuthStrategy, ElectronService, Store } from '../services';
import { getCookie } from './cookie-helper';

@Injectable()
export class AuthGuard {
	constructor(
		private readonly _router: Router,
		private readonly _authService: AuthService,
		private readonly _authStrategy: AuthStrategy,
		private readonly _store: Store,
		private readonly _electronService: ElectronService
	) {}

	/**
	 * Checks if the user is authenticated before allowing navigation to a route.
	 *
	 * @param {ActivatedRouteSnapshot} route - The route to navigate to.
	 * @param {RouterStateSnapshot} state - The current state of the router.
	 * @return {Promise<boolean>} A promise that resolves to true if the user is authenticated, false otherwise.
	 */
	async canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Promise<boolean> {
		const token = route.queryParamMap.get('token') || getCookie('token');
		const userId = route.queryParamMap.get('userId') || getCookie('userId');
		const refreshToken = route.queryParamMap.get('refresh_token') || getCookie('refresh_token');

		// If token and userId exist, store them
		if (token && userId) {
			this._store.token = token;
			this._store.userId = userId;
			this._store.refresh_token = refreshToken;
		}

		// Check if the user is authenticated
		if (await this._authService.isAuthenticated()) {
			return true; // Allow navigation
		}

		// Not authenticated, handle logout
		await this.handleLogout(state.url);
		return false;
	}

	/**
	 * Handles the logout process and redirects to the login page.
	 *
	 * @param {string} returnUrl - The URL to return to after logging in.
	 */
	private async handleLogout(returnUrl: string): Promise<void> {
		if (this._electronService.isElectron) {
			try {
				this._electronService.ipcRenderer.send('logout');
			} catch (error) {
				console.error('Error sending logout message to Electron:', error);
			}
		}

		await firstValueFrom(this._authStrategy.logout());
		await this._router.navigate(['/auth/login'], { queryParams: { returnUrl } });
	}
}
