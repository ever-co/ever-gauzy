import { isAuthUrl, loginReturnUrl } from './login-return-url';

/**
 * Q8d: a stale session on demo stayed on `/auth/login?returnUrl=/auth/login?returnUrl=…` — every failing request
 * redirected to the sign-in page with `returnUrl: <current URL>`, and the current URL was by then the sign-in page.
 */
describe('loginReturnUrl', () => {
	it('keeps an ordinary page, with its query string', () => {
		expect(loginReturnUrl('/pages/dashboard')).toBe('/pages/dashboard');
		expect(loginReturnUrl('/pages/tasks?projectId=1&view=board')).toBe('/pages/tasks?projectId=1&view=board');
	});

	it('unwraps a sign-in URL to the page it carries, however deep', () => {
		const once = `/auth/login?returnUrl=${encodeURIComponent('/pages/dashboard')}`;
		const twice = `/auth/login?returnUrl=${encodeURIComponent(once)}`;
		const thrice = `/auth/login?returnUrl=${encodeURIComponent(twice)}`;

		expect(loginReturnUrl(once)).toBe('/pages/dashboard');
		expect(loginReturnUrl(twice)).toBe('/pages/dashboard');
		expect(loginReturnUrl(thrice)).toBe('/pages/dashboard');
	});

	it('answers nothing for an authentication page that carries no return URL, and for the root', () => {
		expect(loginReturnUrl('/auth/login')).toBeUndefined();
		expect(loginReturnUrl('/auth/register?x=1')).toBeUndefined();
		expect(loginReturnUrl('/')).toBeUndefined();
		expect(loginReturnUrl('')).toBeUndefined();
		expect(loginReturnUrl(null)).toBeUndefined();
	});

	it('never returns a URL outside this application', () => {
		expect(loginReturnUrl('https://example.com/pages')).toBeUndefined();
		expect(loginReturnUrl('//example.com/pages')).toBeUndefined();
		expect(loginReturnUrl(`/auth/login?returnUrl=${encodeURIComponent('https://example.com')}`)).toBeUndefined();
		expect(loginReturnUrl('javascript:alert(1)')).toBeUndefined();
	});

	it('stops on a chain that never reaches a page', () => {
		let url = '/auth/login';

		for (let depth = 0; depth < 20; depth++) {
			url = `/auth/login?returnUrl=${encodeURIComponent(url)}`;
		}

		expect(loginReturnUrl(url)).toBeUndefined();
	});
});

describe('isAuthUrl', () => {
	it('recognises the authentication pages and nothing else', () => {
		expect(isAuthUrl('/auth/login?returnUrl=%2F')).toBe(true);
		expect(isAuthUrl('/auth')).toBe(true);
		expect(isAuthUrl('/authors')).toBe(false);
		expect(isAuthUrl('/pages/auth/login')).toBe(false);
	});
});
