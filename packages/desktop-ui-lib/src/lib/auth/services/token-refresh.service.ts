import { inject, Injectable, OnDestroy } from '@angular/core';
import { combineLatest, EMPTY, interval, map, Observable, of, Subscription, take } from 'rxjs';
import { catchError, concatMap, filter, switchMap, tap } from 'rxjs/operators';
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
 * - Implements circuit breaker to prevent infinite retry loops
 * - Properly manages subscriptions and cleanup
 *
 * Best Practices:
 * 1. Checks token expiry every minute
 * 2. Refreshes token proactively before it expires
 * 3. Prevents duplicate refresh attempts via RefreshStateManager
 * 4. Stops retrying after consecutive failures (circuit breaker)
 * 5. Properly cleans up subscriptions on destroy
 * 6. Errors are caught so the interval keeps running
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
	private readonly MAX_CONSECUTIVE_FAILURES = 3;
	private readonly CIRCUIT_BREAKER_RESET_TIME = 5 * 60 * 1000; // 5 minutes
	private consecutiveFailures = 0;
	private circuitBreakerOpenedAt?: number;

	/**
	 * Starts the automatic token refresh timer.
	 * Safe to call multiple times — previous timer is stopped first.
	 */
	start(): void {
		// Stop any existing timer
		this.stop();

		// Reset failure counter when starting
		this.consecutiveFailures = 0;

		// Check token expiry every minute
		this.intervalSubscription = interval(this.CHECK_INTERVAL)
			.pipe(
				concatMap(() => this.shouldRefreshToken()),
				filter((shouldRefresh) => shouldRefresh),
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
		// Reset failure counter and circuit breaker when stopping
		this.consecutiveFailures = 0;
		this.circuitBreakerOpenedAt = undefined;
	}

	ngOnDestroy(): void {
		this.stop();
	}

	// ──────────────────────────────────────────────
	// Private helpers
	// ──────────────────────────────────────────────

	/**
	 * Determines if a proactive refresh should be attempted.
	 * Includes circuit breaker logic with automatic recovery.
	 */
	private shouldRefreshToken(): Observable<boolean> {
		// Circuit breaker: check if we should attempt recovery
		if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
			const now = Date.now();
			const timeSinceOpen = this.circuitBreakerOpenedAt ? now - this.circuitBreakerOpenedAt : 0;

			// Try to recover after reset time
			if (timeSinceOpen >= this.CIRCUIT_BREAKER_RESET_TIME) {
				console.log('[TokenRefreshService] Circuit breaker attempting recovery...');
				this.consecutiveFailures = 0;
				this.circuitBreakerOpenedAt = undefined;
			} else {
				console.warn(
					`[TokenRefreshService] Circuit breaker open: ${this.consecutiveFailures} consecutive failures. ` +
						`Will retry in ${Math.round((this.CIRCUIT_BREAKER_RESET_TIME - timeSinceOpen) / 1000)}s`
				);
				return of(false);
			}
		}

		return combineLatest([this.store.isAuthenticated$, this.store.isOffline$]).pipe(
			take(1),
			map(
				([isAuthenticated, isOffline]) =>
					isAuthenticated &&
					!isOffline &&
					this.store.isTokenExpired() &&
					!this.refreshStateManager.isRefreshInProgress()
			)
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
				this.consecutiveFailures++;
				return EMPTY;
			})
		);
	}

	/**
	 * Handles successful refresh result.
	 */
	private handleRefreshResult(result: any): void {
		if (result?.isSuccess?.()) {
			// Success - reset failure counter and circuit breaker
			this.consecutiveFailures = 0;
			this.circuitBreakerOpenedAt = undefined;
		} else {
			console.warn('[TokenRefreshService] Proactive refresh failed:', result?.getErrors?.());
			this.consecutiveFailures++;
			if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES && !this.circuitBreakerOpenedAt) {
				this.circuitBreakerOpenedAt = Date.now();
			}
		}
	}

	/**
	 * Handles refresh errors (should rarely happen due to catchError).
	 */
	private handleRefreshError(error: any): void {
		console.error('[TokenRefreshService] Unexpected error in refresh stream:', error);
		this.consecutiveFailures++;
		if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES && !this.circuitBreakerOpenedAt) {
			this.circuitBreakerOpenedAt = Date.now();
		}
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
