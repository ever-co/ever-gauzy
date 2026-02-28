import { Injectable, OnDestroy } from '@angular/core';
import { Observable, ReplaySubject, throwError } from 'rxjs';
import { map, take } from 'rxjs/operators';

type RefreshResult = { token?: string; error?: Error };

/**
 * Manages the state of token refresh operations.
 * Single Responsibility: Track refresh state and coordinate concurrent requests.
 *
 * Key behaviors:
 * - Ensures only one refresh runs at a time
 * - Queues concurrent requests and unblocks them on success
 * - Propagates errors to all queued requests on failure
 * - Uses a per-refresh ReplaySubject to avoid race conditions
 * - Properly cleans up on logout
 */
@Injectable({
	providedIn: 'root'
})
export class RefreshStateManager implements OnDestroy {
	private isRefreshing = false;
	private refreshResult$?: ReplaySubject<RefreshResult>;

	isRefreshInProgress(): boolean {
		return this.isRefreshing;
	}

	startRefresh(): void {
		if (this.isRefreshing) {
			console.warn('[RefreshStateManager] Refresh already in progress, ignoring duplicate start');
			return;
		}

		this.isRefreshing = true;
		this.refreshResult$ = new ReplaySubject<RefreshResult>(1);
	}

	completeRefresh(token: string): void {
		if (!this.isRefreshing || !this.refreshResult$) {
			console.warn('[RefreshStateManager] No refresh in progress, ignoring complete');
			return;
		}

		this.isRefreshing = false;
		this.refreshResult$.next({ token });
		this.refreshResult$.complete();
		this.refreshResult$ = undefined;
	}

	failRefresh(error: Error): void {
		if (!this.isRefreshing || !this.refreshResult$) {
			console.warn('[RefreshStateManager] No refresh in progress, ignoring failure');
			return;
		}

		this.isRefreshing = false;
		this.refreshResult$.next({ error });
		this.refreshResult$.complete();
		this.refreshResult$ = undefined;
	}

	/**
	 * Returns an observable that emits when a token becomes available
	 * or errors if the refresh fails.
	 * Returns an error immediately when no refresh is active.
	 */
	waitForToken(): Observable<string> {
		if (!this.refreshResult$) {
			return throwError(() => new Error('[RefreshStateManager] No active refresh to wait for'));
		}

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

	/**
	 * Resets the refresh state. Should be called on logout.
	 */
	reset(): void {
		if (this.refreshResult$) {
			this.refreshResult$.next({ error: new Error('Token refresh cancelled') });
			this.refreshResult$.complete();
			this.refreshResult$ = undefined;
		}

		this.isRefreshing = false;
	}

	ngOnDestroy(): void {
		this.refreshResult$?.complete();
		this.refreshResult$ = undefined;
	}
}
