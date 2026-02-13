import { HttpErrorResponse, HttpEvent, HttpHandler, HttpRequest } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NbAuthResult } from '@nebular/auth';
import { Observable, throwError } from 'rxjs';
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
		this.refreshStateManager.startRefresh();

		if (!this.store.refreshToken) {
			return this.handleRefreshError(originalError);
		}

		return this.authStrategy.refreshToken().pipe(
			switchMap((result: NbAuthResult) => this.handleRefreshResult(result, request, next, originalError)),
			catchError(() => this.handleRefreshError(originalError))
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
			this.refreshStateManager.completeRefresh(newToken);
			return next.handle(this.requestCloner.cloneWithToken(request, newToken));
		}

		return throwError(() => originalError);
	}

	private handleRefreshError(originalError: HttpErrorResponse): Observable<never> {
		this.refreshStateManager.failRefresh(originalError);
		return this.handleSessionExpiry(originalError);
	}

	private handleSessionExpiry(originalError: HttpErrorResponse): Observable<never> {
		return this.sessionExpiredHandler.execute().pipe(concatMap(() => throwError(() => originalError)));
	}
}
