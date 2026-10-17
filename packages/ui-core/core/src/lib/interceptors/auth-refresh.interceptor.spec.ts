import { HttpClient, HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { Store } from '../services/store/store.service';
import { AuthRefreshInterceptor } from './auth-refresh.interceptor';

/**
 * Q8d: a stale session (a token from before a demo reseed) stayed on the dashboard skeleton at
 * `/auth/login?returnUrl=/auth/login?returnUrl=…`. Every request of the session failed with 401, its refresh failed,
 * and each failure redirected with `returnUrl: router.url` — the second one from the sign-in page the first had just
 * opened, wrapping it in itself, and each redirect superseding the navigation before it.
 */
describe('AuthRefreshInterceptor — the redirect when a session cannot be refreshed', () => {
	let http: HttpClient;
	let backend: HttpTestingController;
	let router: {
		url: string;
		navigate: jest.Mock;
		getCurrentNavigation: jest.Mock;
		serializeUrl: (tree: any) => string;
	};

	beforeEach(() => {
		router = {
			url: '/pages/dashboard',
			navigate: jest.fn().mockResolvedValue(true),
			getCurrentNavigation: jest.fn().mockReturnValue(null),
			serializeUrl: (tree: any) => String(tree)
		};

		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(withInterceptorsFromDi()),
				provideHttpClientTesting(),
				{ provide: Store, useValue: { token: 'a.stale.token', refresh_token: 'a.stale.refresh' } },
				{
					provide: AuthService,
					useValue: { refreshToken: jest.fn().mockRejectedValue(new Error('refresh token expired')) }
				},
				{ provide: Router, useValue: router },
				{ provide: HTTP_INTERCEPTORS, useClass: AuthRefreshInterceptor, multi: true }
			]
		});
		http = TestBed.inject(HttpClient);
		backend = TestBed.inject(HttpTestingController);
	});

	afterEach(() => backend.verify());

	/** One API request answered 401, and the refresh that follows it failing. */
	async function failWithStaleSession(): Promise<void> {
		const settled = new Promise<void>((resolve) => http.get('/api/user/me').subscribe({ error: () => resolve() }));

		backend.expectOne('/api/user/me').flush({}, { status: 401, statusText: 'Unauthorized' });
		await settled;
	}

	it('sends the user to the sign-in page with the page they were on', async () => {
		await failWithStaleSession();

		expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
			queryParams: { returnUrl: '/pages/dashboard' }
		});
	});

	it('does not redirect again from the sign-in page, so the URL never nests', async () => {
		router.url = `/auth/login?returnUrl=${encodeURIComponent('/pages/dashboard')}`;

		await failWithStaleSession();

		expect(router.navigate).not.toHaveBeenCalled();
	});

	it('does not start a second redirect while one to the sign-in page is under way', async () => {
		router.url = '/';
		router.getCurrentNavigation.mockReturnValue({
			finalUrl: `/auth/login?returnUrl=${encodeURIComponent('/pages/dashboard')}`
		});

		await failWithStaleSession();

		expect(router.navigate).not.toHaveBeenCalled();
	});

	it('returns to the page the first navigation was heading for, not to the empty start URL', async () => {
		router.url = '/';
		router.getCurrentNavigation.mockReturnValue({ extractedUrl: '/pages/time-tracking' });

		await failWithStaleSession();

		expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
			queryParams: { returnUrl: '/pages/time-tracking' }
		});
	});

	it('states no return URL when there is no page to come back to', async () => {
		router.url = '/';

		await failWithStaleSession();

		expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {});
	});
});
