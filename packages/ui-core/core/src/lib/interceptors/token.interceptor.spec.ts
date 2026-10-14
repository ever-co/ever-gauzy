import { HttpClient, provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Store } from '../services/store';
import { TokenInterceptor } from './token.interceptor';

/**
 * The bearer token carries every permission of the user's role (380 for a super admin after the platform-extensions
 * merge, ~11.5 KB). Sent on the app's own static files it is useless and it broke the demo: the web image's nginx refuses
 * any header line above 8 KB, so `./assets/i18n/en.json` answered "400 Request Header Or Cookie Too Large" for every
 * signed-in user. API requests keep the token.
 */
describe('TokenInterceptor', () => {
	let http: HttpClient;
	let backend: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(withInterceptorsFromDi()),
				provideHttpClientTesting(),
				{ provide: Store, useValue: { token: 'a.jwt.token' } },
				{ provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true }
			]
		});
		http = TestBed.inject(HttpClient);
		backend = TestBed.inject(HttpTestingController);
	});

	afterEach(() => backend.verify());

	it.each(['./assets/i18n/en.json', 'assets/i18n/en.json', '/assets/images/logos/logo.svg'])(
		'does not send the token with the app\'s own static file %s',
		(url) => {
			http.get(url).subscribe();

			const request = backend.expectOne(url);
			expect(request.request.headers.has('Authorization')).toBe(false);
			request.flush({});
		}
	);

	it.each(['/api/user/me', 'https://apidemo.gauzy.co/api/organization', 'https://apidemo.gauzy.co/graphql'])(
		'sends the token with an API request %s',
		(url) => {
			http.get(url).subscribe();

			const request = backend.expectOne(url);
			expect(request.request.headers.get('Authorization')).toBe('Bearer a.jwt.token');
			request.flush({});
		}
	);
});
