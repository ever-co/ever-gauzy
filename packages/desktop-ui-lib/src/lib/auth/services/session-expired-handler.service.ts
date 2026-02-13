import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';
import { ElectronService } from '../../electron/services';
import { AuthStrategy } from './auth-strategy.service';
import { TokenRefreshService } from './token-refresh.service';

/**
 * Centralized handler for session expiration.
 *
 * Responsibilities:
 * - Stops proactive token refresh
 * - Clears authentication state
 * - Notifies other Electron windows via IPC
 * - Navigates to login with return URL
 *
 * This service is the single source of truth for logout-on-expiry,
 * ensuring consistency across multiple Electron windows that share
 * the same persistent store.
 *
 * Note: This operation is idempotent - multiple calls are safe.
 */
@Injectable({
	providedIn: 'root'
})
export class SessionExpiredHandler {
	private readonly authStrategy = inject(AuthStrategy);
	private readonly electronService = inject(ElectronService);
	private readonly router = inject(Router);
	private readonly tokenRefreshService = inject(TokenRefreshService);

	private isExecuting = false;

	/**
	 * Executes the full session-expiry flow:
	 * 1. Stops proactive refresh timer
	 * 2. Clears auth state (token, user, etc.)
	 * 3. Sends IPC `logout` event for cross-window sync (Electron only)
	 * 4. Navigates to `/auth/login` with a `returnUrl`
	 *
	 * This method is idempotent - multiple calls will only execute once.
	 *
	 * @returns Observable<void> that completes after logout finishes
	 */
	execute(): Observable<void> {
		// Prevent concurrent executions
		if (this.isExecuting) {
			return of(void 0);
		}

		this.isExecuting = true;

		// Stop the proactive refresh timer immediately
		this.tokenRefreshService.stop();

		return this.authStrategy.logout().pipe(
			tap(() => this.notifyElectronWindows()),
			catchError((error) => {
				console.error('[SessionExpiredHandler] Logout failed:', error);
				// Continue with navigation even if logout fails
				return of(void 0);
			}),
			finalize(() => {
				// Always navigate and reset flag, even on error
				this.navigateToLogin();
				this.isExecuting = false;
			}),
			map(() => void 0)
		);
	}

	// ──────────────────────────────────────────────
	// Private helpers
	// ──────────────────────────────────────────────

	/**
	 * Notifies other Electron windows about logout via IPC.
	 * Safe to call in browser context (no-op if not Electron).
	 */
	private notifyElectronWindows(): void {
		if (this.electronService.ipcRenderer) {
			try {
				this.electronService.ipcRenderer.send('logout');
			} catch (error) {
				console.error('[SessionExpiredHandler] Failed to send IPC logout:', error);
			}
		}
	}

	/**
	 * Navigates to login page with return URL.
	 * Excludes auth routes from return URL to prevent loops.
	 */
	private navigateToLogin(): void {
		const currentUrl = this.router.url;
		const returnUrl = this.shouldPreserveReturnUrl(currentUrl) ? currentUrl : null;

		this.router.navigate(['auth', 'login'], {
			queryParams: returnUrl ? { returnUrl } : {}
		});
	}

	/**
	 * Determines if the current URL should be preserved as return URL.
	 * Excludes auth routes to prevent redirect loops.
	 */
	private shouldPreserveReturnUrl(url: string): boolean {
		// Don't preserve auth routes
		if (url.startsWith('/auth')) {
			return false;
		}

		// Don't preserve root
		if (url === '/' || url === '') {
			return false;
		}

		return true;
	}
}
