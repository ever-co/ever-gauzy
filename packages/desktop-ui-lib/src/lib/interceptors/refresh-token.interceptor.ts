import {
	HttpErrorResponse,
	HttpEvent,
	HttpHandler,
	HttpInterceptor,
	HttpRequest,
	HttpStatusCode
} from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TokenRefreshHandler } from '../auth';
import { AUTH_ENDPOINTS } from '../constants';
import { Store } from '../services';

/**
 * HTTP interceptor that reacts to 401 Unauthorized responses and refresh the token if possible.
 */
@Injectable()
export class RefreshTokenInterceptor implements HttpInterceptor {
	private readonly store = inject(Store);
	private readonly tokenRefreshHandler = inject(TokenRefreshHandler);

	intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		return next.handle(request).pipe(
			catchError((error: HttpErrorResponse) => {
				if (this.shouldSkipErrorHandling(request.url, error)) {
					return throwError(() => error);
				}

				return this.tokenRefreshHandler.handle(request, next, error);
			})
		);
	}

	/**
	 * Guards that short-circuit error handling:
	 * - Offline mode — no network, nothing to retry.
	 * - Non-401 status — not an auth problem.
	 * - Auth endpoint — prevent infinite refresh loops.
	 */
	private shouldSkipErrorHandling(url: string, error: HttpErrorResponse): boolean {
		return this.store.isOffline || error.status !== HttpStatusCode.Unauthorized || this.isAuthEndpoint(url);
	}

	/**
	 * Returns `true` when the URL matches a known authentication
	 * endpoint (login, register, refresh-token, etc.) to prevent
	 * infinite refresh loops.
	 */
	private isAuthEndpoint(url: string): boolean {
		return AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));
	}
}
