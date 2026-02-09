import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { ElectronService } from '../../electron/services';
import { AuthStrategy } from './auth-strategy.service';
import { TokenRefreshService } from './token-refresh.service';

/**
 * Centralized handler for session expiration.
 *
 * This service is the single source of truth for logout-on-expiry,
 * ensuring consistency across multiple Electron windows that share
 * the same persistent store.
 */
@Injectable({
	providedIn: 'root'
})
export class SessionExpiredHandler {
	private readonly authStrategy = inject(AuthStrategy);
	private readonly electronService = inject(ElectronService);
	private readonly router = inject(Router);
	private readonly tokenRefreshService = inject(TokenRefreshService);

	/**
	 * Executes the full session-expiry flow:
	 * 1. Clears auth state (token, user, etc.)
	 * 2. Sends IPC `logout` event for cross-window sync
	 * 3. Navigates to `/auth/login` with a `returnUrl`
	 *
	 * @returns Observable<void> that completes after logout finishes
	 */
	execute(): Observable<void> {
		// Stop the proactive refresh timer immediately
		this.tokenRefreshService.stop();

		return this.authStrategy.logout().pipe(
			tap(() => {
				// Notify every Electron window via IPC
				this.electronService.ipcRenderer.send('logout');

				// Preserve the current route so the user can resume after re-login
				this.router.navigate(['auth', 'login'], {
					queryParams: { returnUrl: this.router.url }
				});
			}),
			// Discard the NbAuthResult — callers only care about completion
			map(() => void 0)
		);
	}
}
