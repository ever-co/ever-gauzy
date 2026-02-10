import { inject, Injectable, OnDestroy } from '@angular/core';
import { EMPTY, interval, Subscription } from 'rxjs';
import { catchError, filter, switchMap, tap } from 'rxjs/operators';
import { Store } from '../../services';
import { AuthStrategy } from './auth-strategy.service';
import { RefreshStateManager } from './refresh-state-manager.service';

/**
 * Service that handles proactive token refresh before expiration.
 *
 * Responsibilities:
 * - Periodically checks token expiration
 * - Triggers proactive refresh before token expires
 * - Coordinates with RefreshStateManager to prevent duplicate refreshes
 * - Properly manages subscriptions and cleanup
 *
 * Best Practices:
 * 1. Checks token expiry every minute
 * 2. Refreshes token proactively before it expires
 * 3. Prevents duplicate refresh attempts via RefreshStateManager
 * 4. Properly cleans up subscriptions on destroy
 * 5. Errors are caught so the interval keeps running
 */
@Injectable({
	providedIn: 'root'
})
export class TokenRefreshService implements OnDestroy {
	private readonly store = inject(Store);
	private readonly authStrategy = inject(AuthStrategy);
	private readonly refreshStateManager = inject(RefreshStateManager);

	private intervalSubscription?: Subscription;
	private readonly CHECK_INTERVAL = 60 * 1000; // Check every minute

	/**
	 * Starts the automatic token refresh timer.
	 * Safe to call multiple times — previous timer is stopped first.
	 */
	start(): void {
		// Stop any existing timer
		this.stop();

		// Check token expiry every minute
		this.intervalSubscription = interval(this.CHECK_INTERVAL)
			.pipe(
				filter(() => this.shouldRefreshToken()),
				tap(() => this.logRefreshAttempt()),
				switchMap(() => this.performRefresh())
			)
			.subscribe({
				next: (result) => this.handleRefreshResult(result),
				error: (error) => this.handleRefreshError(error)
			});
	}

	/**
	 * Stops the automatic token refresh timer.
	 */
	stop(): void {
		if (this.intervalSubscription) {
			this.intervalSubscription.unsubscribe();
			this.intervalSubscription = undefined;
		}
	}

	ngOnDestroy(): void {
		this.stop();
	}

	// ──────────────────────────────────────────────
	// Private helpers
	// ──────────────────────────────────────────────

	/**
	 * Determines if a proactive refresh should be attempted.
	 */
	private shouldRefreshToken(): boolean {
		return (
			!!this.store.refreshToken &&
			this.store.isTokenExpired() &&
			!this.store.isOffline &&
			!this.refreshStateManager.isRefreshInProgress()
		);
	}

	/**
	 * Performs the actual token refresh operation.
	 */
	private performRefresh() {
		return this.authStrategy.refreshToken().pipe(
			catchError((error) => {
				// Swallow the error so the interval keeps ticking
				console.error('[TokenRefreshService] Error during proactive refresh:', error);
				return EMPTY;
			})
		);
	}

	/**
	 * Handles successful refresh result.
	 */
	private handleRefreshResult(result: any): void {
		if (result?.isSuccess?.()) {
			// Success - token updated in store by AuthStrategy
		} else {
			console.warn('[TokenRefreshService] Proactive refresh failed:', result?.getErrors?.());
		}
	}

	/**
	 * Handles refresh errors (should rarely happen due to catchError).
	 */
	private handleRefreshError(error: any): void {
		console.error('[TokenRefreshService] Unexpected error in refresh stream:', error);
	}

	/**
	 * Logs refresh attempt (can be removed or replaced with proper logging service).
	 */
	private logRefreshAttempt(): void {
		if (typeof console !== 'undefined' && console.log) {
			console.log('[TokenRefreshService] Token expiring soon, refreshing proactively...');
		}
	}
}
