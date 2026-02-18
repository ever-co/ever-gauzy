import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter, map, take } from 'rxjs/operators';

/**
 * Manages the state of token refresh operations.
 * Single Responsibility: Track refresh state and coordinate concurrent requests.
 *
 * Key behaviors:
 * - Ensures only one refresh runs at a time
 * - Queues concurrent requests and unblocks them on success
 * - Propagates errors to all queued requests on failure
 * - Uses a single Subject to avoid race conditions
 * - Properly cleans up on logout
 */
@Injectable({
	providedIn: 'root'
})
export class RefreshStateManager implements OnDestroy {
	private isRefreshing = false;
	private refreshResult$ = new Subject<{ token?: string; error?: Error }>();
	private currentRefreshId = 0;

	isRefreshInProgress(): boolean {
		return this.isRefreshing;
	}

	startRefresh(): void {
		if (this.isRefreshing) {
			console.warn('[RefreshStateManager] Refresh already in progress, ignoring duplicate start');
			return;
		}
		this.isRefreshing = true;
		this.currentRefreshId++;
	}

	completeRefresh(token: string): void {
		if (!this.isRefreshing) {
			console.warn('[RefreshStateManager] No refresh in progress, ignoring complete');
			return;
		}
		this.isRefreshing = false;
		this.refreshResult$.next({ token });
	}

	failRefresh(error: Error): void {
		if (!this.isRefreshing) {
			console.warn('[RefreshStateManager] No refresh in progress, ignoring failure');
			return;
		}
		this.isRefreshing = false;
		this.refreshResult$.next({ error });
	}

	/**
	 * Returns an observable that emits when a token becomes available
	 * or errors if the refresh fails.
	 * Captures the current refresh ID to ensure we only respond to the current refresh.
	 */
	waitForToken(): Observable<string> {
		const refreshId = this.currentRefreshId;
		return this.refreshResult$.pipe(
			filter(() => this.currentRefreshId === refreshId),
			take(1),
			map((result) => {
				if (result.error) {
					throw result.error;
				}
				if (!result.token) {
					throw new Error('Token refresh completed without token or error');
				}
				return result.token;
			})
		);
	}

	/**
	 * Resets the refresh state. Should be called on logout.
	 */
	reset(): void {
		this.isRefreshing = false;
		this.currentRefreshId++;
	}

	ngOnDestroy(): void {
		this.refreshResult$.complete();
	}
}
