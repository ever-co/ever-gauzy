import { HttpErrorResponse, HttpEvent, HttpHandler, HttpRequest } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NbAuthResult } from '@nebular/auth';
import { Observable, take, throwError } from 'rxjs';
import { catchError, concatMap, switchMap } from 'rxjs/operators';
import { Store } from '../../services';
import { AuthStrategy } from './auth-strategy.service';
import { RefreshStateManager } from './refresh-state-manager.service';
import { SessionExpiredHandler } from './session-expired-handler.service';
import { TokenRequestCloner } from './token-request-cloner.service';

/**
 * Executes the token refresh operation.
 * Single Responsibility: Orchestrate the refresh flow and handle success/failure.
 */
@Injectable({
	providedIn: 'root'
})
export class TokenRefreshExecutor {
	private readonly authStrategy = inject(AuthStrategy);
	private readonly store = inject(Store);
	private readonly sessionExpiredHandler = inject(SessionExpiredHandler);
	private readonly refreshStateManager = inject(RefreshStateManager);
	private readonly requestCloner = inject(TokenRequestCloner);

	execute(
		request: HttpRequest<any>,
		next: HttpHandler,
		originalError: HttpErrorResponse
	): Observable<HttpEvent<any>> {
		// Check for refresh token before starting refresh state
		// This check is synchronized with refresh state to prevent race condition
		return this.store.isAuthenticated$.pipe(
			take(1),
			switchMap((isAuthenticated) => {
				if (!isAuthenticated) {
					return this.handleSessionExpiry(originalError);
				}
				// Mark refresh as in-progress before making the call
				this.refreshStateManager.startRefresh();
				return this.authStrategy.refreshToken().pipe(
					switchMap((result: NbAuthResult) => this.handleRefreshResult(result, request, next, originalError)),
					catchError((error) => this.handleRefreshError(originalError, error))
				);
			})
		);
	}

	private handleRefreshResult(
		result: NbAuthResult,
		request: HttpRequest<any>,
		next: HttpHandler,
		originalError: HttpErrorResponse
	): Observable<HttpEvent<any>> {
		if (result.isSuccess()) {
			const newToken = this.store.token;
			if (!newToken) {
				console.error('[TokenRefreshExecutor] Refresh succeeded but no token in store');
				this.refreshStateManager.failRefresh(new Error('No token after refresh'));
				return this.handleSessionExpiry(originalError);
			}
			this.refreshStateManager.completeRefresh(newToken);
			return next.handle(this.requestCloner.cloneWithToken(request, newToken));
		}

		console.warn('[TokenRefreshExecutor] Refresh failed:', result.getErrors());
		this.refreshStateManager.failRefresh(new Error('Token refresh failed'));
		return this.handleSessionExpiry(originalError);
	}

	private handleRefreshError(originalError: HttpErrorResponse, refreshError?: any): Observable<never> {
		console.error('[TokenRefreshExecutor] Refresh error:', refreshError);
		this.refreshStateManager.failRefresh(refreshError || new Error('Unknown refresh error'));
		return this.handleSessionExpiry(originalError);
	}

	private handleSessionExpiry(originalError: HttpErrorResponse): Observable<never> {
		return this.sessionExpiredHandler.execute().pipe(concatMap(() => throwError(() => originalError)));
	}
}
