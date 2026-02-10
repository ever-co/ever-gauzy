import { HttpErrorResponse, HttpEvent, HttpHandler, HttpRequest } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { RefreshStateManager } from './refresh-state-manager.service';
import { TokenRefreshExecutor } from './token-refresh-executor.service';
import { TokenRequestCloner } from './token-request-cloner.service';

/**
 * Coordinates token refresh for 401 responses.
 * Single Responsibility: Route requests to either refresh execution or queuing.
 * Open/Closed: New refresh strategies can be added without modifying this class.
 * Dependency Inversion: Depends on abstractions (injected services) not concrete implementations.
 */
@Injectable({
	providedIn: 'root'
})
export class TokenRefreshHandler {
	private readonly refreshStateManager = inject(RefreshStateManager);
	private readonly refreshExecutor = inject(TokenRefreshExecutor);
	private readonly requestCloner = inject(TokenRequestCloner);

	/**
	 * Entry point called by the interceptor on every 401 response.
	 *
	 * @param request  The original failed request
	 * @param next     The HTTP handler to replay the request through
	 * @param originalError The original 401 `HttpErrorResponse` (preserved)
	 * @returns An observable of the retried (or failed) HTTP event
	 */
	handle(request: HttpRequest<any>, next: HttpHandler, originalError: HttpErrorResponse): Observable<HttpEvent<any>> {
		if (this.refreshStateManager.isRefreshInProgress()) {
			return this.queueRequest(request, next);
		}
		return this.refreshExecutor.execute(request, next, originalError);
	}

	/**
	 * Queues concurrent 401 requests behind the in-flight refresh.
	 * They resume as soon as a new token is available.
	 * If the refresh fails, the error is propagated to all queued requests.
	 */
	private queueRequest(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		return this.refreshStateManager.waitForToken().pipe(
			switchMap((token) => next.handle(this.requestCloner.cloneWithToken(request, token))),
			catchError((error) => throwError(() => error))
		);
	}
}
