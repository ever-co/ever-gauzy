import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, finalize, map, tap } from 'rxjs/operators';
import { ElectronService } from '../../electron/services';
import { AuthStrategy } from './auth-strategy.service';
import { RefreshStateManager } from './refresh-state-manager.service';
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
	private readonly refreshStateManager = inject(RefreshStateManager);

	private isExecuting = false;
	private executionLock = false;

	/**
	 * Executes the full session-expiry flow:
	 * 1. Stops proactive refresh timer
	 * 2. Resets refresh state manager
	 * 3. Clears auth state (token, user, etc.)
	 * 4. Sends IPC `logout` event for cross-window sync (Electron only)
	 * 5. Navigates to `/auth/login` with a `returnUrl`
	 *
	 * This method is idempotent - multiple calls will only execute once.
	 * Uses atomic flag to prevent race conditions from concurrent 401s.
	 *
	 * @returns Observable<void> that completes after logout finishes
	 */
	execute(): Observable<void> {
		// Atomic check-and-set to prevent concurrent executions
		if (this.executionLock) {
			return of(void 0);
		}
		this.executionLock = true;

		// Prevent concurrent executions
		if (this.isExecuting) {
			this.executionLock = false;
			return of(void 0);
		}

		this.isExecuting = true;

		// Stop the proactive refresh timer immediately
		this.tokenRefreshService.stop();

		// Reset refresh state manager to clear any pending refresh operations
		this.refreshStateManager.reset();

		return this.authStrategy.logout().pipe(
			tap(() => this.notifyElectronWindows()),
			catchError((error) => {
				console.error('[SessionExpiredHandler] Logout failed:', error);
				// Continue with navigation even if logout fails
				return of(void 0);
			}),
			finalize(() => {
				// Always navigate and reset flags, even on error
				this.navigateToLogin();
				this.isExecuting = false;
				this.executionLock = false;
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
