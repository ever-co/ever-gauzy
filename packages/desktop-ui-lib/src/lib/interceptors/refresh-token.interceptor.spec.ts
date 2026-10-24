import { HttpContext, HttpErrorResponse, HttpHandler, HttpRequest } from '@angular/common/http';
import { Injector, runInInjectionContext } from '@angular/core';
import { BehaviorSubject, firstValueFrom, of, throwError } from 'rxjs';
import { SessionExpiredHandler, TokenRefreshHandler } from '../auth';
import { Store } from '../services';
import { RefreshTokenInterceptor } from './refresh-token.interceptor';
import { SKIP_TOKEN_REFRESH } from './skip-token-refresh.token';

/**
 * A refused organization switch answers 401 although the session is fine. Refreshing and retrying it would be refused
 * again, and `TokenRefreshExecutor` would take that for an expired session and log the user out, so a request marked
 * with `SKIP_TOKEN_REFRESH` gets its 401 back untouched.
 */
describe('RefreshTokenInterceptor', () => {
	const unauthorized = new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' });

	let tokenRefreshHandler: { handle: jest.Mock };
	let sessionExpiredHandler: { execute: jest.Mock };
	let next: HttpHandler;
	let interceptor: RefreshTokenInterceptor;

	beforeEach(() => {
		tokenRefreshHandler = { handle: jest.fn().mockReturnValue(of({})) };
		sessionExpiredHandler = { execute: jest.fn().mockReturnValue(of(undefined)) };
		next = { handle: jest.fn(() => throwError(() => unauthorized)) } as unknown as HttpHandler;

		const injector = Injector.create({
			providers: [
				{
					provide: Store,
					useValue: { isOffline$: new BehaviorSubject(false), isAuthenticated$: new BehaviorSubject(true) }
				},
				{ provide: TokenRefreshHandler, useValue: tokenRefreshHandler },
				{ provide: SessionExpiredHandler, useValue: sessionExpiredHandler }
			]
		});
		interceptor = runInInjectionContext(injector, () => new RefreshTokenInterceptor());
	});

	it('hands the 401 of a request marked SKIP_TOKEN_REFRESH straight back: no refresh, retry or logout', async () => {
		const request = new HttpRequest(
			'POST',
			'/api/auth/switch-organization',
			{ organizationId: 'org-b' },
			{ context: new HttpContext().set(SKIP_TOKEN_REFRESH, true) }
		);

		await expect(firstValueFrom(interceptor.intercept(request, next))).rejects.toBe(unauthorized);

		expect(next.handle).toHaveBeenCalledTimes(1);
		expect(tokenRefreshHandler.handle).not.toHaveBeenCalled();
		expect(sessionExpiredHandler.execute).not.toHaveBeenCalled();
	});

	it('still refreshes the token for the 401 of an unmarked request', async () => {
		const request = new HttpRequest('GET', '/api/timesheet/timer/status');

		await firstValueFrom(interceptor.intercept(request, next));

		expect(tokenRefreshHandler.handle).toHaveBeenCalledWith(request, next, unauthorized);
		expect(sessionExpiredHandler.execute).not.toHaveBeenCalled();
	});
});
