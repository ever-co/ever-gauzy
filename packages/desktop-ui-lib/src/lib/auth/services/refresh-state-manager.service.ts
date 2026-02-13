import { Injectable, OnDestroy } from '@angular/core';
import { Observable, ReplaySubject } from 'rxjs';
import { map, take } from 'rxjs/operators';

/**
 * Manages the state of token refresh operations.
 * Single Responsibility: Track refresh state and coordinate concurrent requests.
 *
 * Key behaviors:
 * - Ensures only one refresh runs at a time
 * - Queues concurrent requests and unblocks them on success
 * - Propagates errors to all queued requests on failure
 * - Uses ReplaySubject to ensure late subscribers receive the result
 * - Properly cleans up subjects to prevent memory leaks
 */
@Injectable({
	providedIn: 'root'
})
export class RefreshStateManager implements OnDestroy {
	private isRefreshing = false;
	private refreshResult$ = new ReplaySubject<{ token?: string; error?: Error }>(1);

	isRefreshInProgress(): boolean {
		return this.isRefreshing;
	}

	startRefresh(): void {
		this.isRefreshing = true;
		// Clear previous results
		this.refreshResult$.complete();
		this.refreshResult$ = new ReplaySubject<{ token?: string; error?: Error }>(1);
	}

	completeRefresh(token: string): void {
		this.isRefreshing = false;
		this.refreshResult$.next({ token });
	}

	failRefresh(error: Error): void {
		this.isRefreshing = false;
		this.refreshResult$.next({ error });
	}

	/**
	 * Returns an observable that emits when a token becomes available
	 * or errors if the refresh fails.
	 * Uses ReplaySubject to ensure late subscribers get the result.
	 */
	waitForToken(): Observable<string> {
		return this.refreshResult$.pipe(
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

	ngOnDestroy(): void {
		this.refreshResult$.complete();
	}
}
