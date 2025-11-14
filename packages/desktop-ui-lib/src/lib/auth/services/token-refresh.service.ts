import { Injectable, OnDestroy } from '@angular/core';
import { interval, Subject } from 'rxjs';
import { filter, switchMap, takeUntil } from 'rxjs/operators';
import { Store } from '../../services';
import { AuthStrategy } from './auth-strategy.service';

/**
 * Service that handles proactive token refresh before expiration.
 *
 * Best Practices:
 * 1. Checks token expiry every minute
 * 2. Refreshes token proactively before it expires (5 min buffer)
 * 3. Prevents unnecessary refresh attempts when token is still valid
 * 4. Properly cleans up subscriptions on destroy
 */
@Injectable({
	providedIn: 'root'
})
export class TokenRefreshService implements OnDestroy {
	private destroy$ = new Subject<void>();
	private readonly CHECK_INTERVAL = 60 * 1000; // Check every minute

	constructor(private readonly store: Store, private readonly authStrategy: AuthStrategy) {}

	/**
	 * Starts the automatic token refresh timer
	 */
	start(): void {
		// Stop any existing timer
		this.stop();

		// Check token expiry every minute
		interval(this.CHECK_INTERVAL)
			.pipe(
				takeUntil(this.destroy$),
				filter(() => {
					// Only proceed if:
					// 1. We have a refresh token
					// 2. Token is expired/expiring
					// 3. Not in offline mode
					return !!this.store.refreshToken && this.store.isTokenExpired() && !this.store.isOffline;
				}),
				switchMap(() => {
					console.log('Token expiring soon, refreshing proactively...');
					return this.authStrategy.refreshToken();
				})
			)
			.subscribe({
				next: (result) => {
					if (result.isSuccess()) {
						console.log('Token refreshed successfully (proactive)');
					} else {
						console.warn('Failed to refresh token proactively:', result.getErrors());
					}
				},
				error: (error) => {
					console.error('Error during proactive token refresh:', error);
				}
			});
	}

	/**
	 * Stops the automatic token refresh timer
	 */
	stop(): void {
		this.destroy$.next();
	}

	ngOnDestroy(): void {
		this.stop();
	}
}
