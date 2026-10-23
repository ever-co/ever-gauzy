// The services barrel reaches the whole client (the auth strategy, the cookie service, the stores); the guard only
// needs the classes as injection tokens, and every case hands it doubles.
jest.mock('../services', () => ({
	AuthService: class AuthService {},
	AuthStrategy: class AuthStrategy {},
	ElectronService: class ElectronService {},
	Store: class Store {}
}));

import { of, throwError } from 'rxjs';
import { AuthGuard } from './auth.guard';

/**
 * Q8d: the guard is the first thing a stale session meets. A check that rejected (the API unreachable, or a 401 whose
 * refresh failed) rejected the guard, the navigation ended in an error with nothing rendered, and the app's loading
 * skeleton stayed; and the URL it sent the user back to could itself be a sign-in URL.
 */
describe('AuthGuard — a session that is not, or no longer, signed in', () => {
	const route = (params: Record<string, string> = {}) => ({
		queryParamMap: { get: (key: string) => params[key] ?? null }
	});

	function guard(isAuthenticated: () => Promise<boolean>, logout = () => of(true as any)) {
		const router = { navigate: jest.fn().mockResolvedValue(true) };
		const authService = { isAuthenticated: jest.fn(isAuthenticated) };
		const authStrategy = { logout: jest.fn(logout) };
		const store = { token: null, userId: null, refresh_token: null };
		const electron = { isElectron: false };

		return {
			router,
			guard: new AuthGuard(
				router as never,
				authService as never,
				authStrategy as never,
				store as never,
				electron as never
			)
		};
	}

	afterEach(() => {
		document.cookie.split(';').forEach((cookie) => {
			document.cookie = `${cookie.split('=')[0].trim()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
		});
	});

	it('answers a check that fails as "not signed in" and sends the user to the sign-in page', async () => {
		const { guard: subject, router } = guard(() => Promise.reject(new Error('401, refresh failed')));

		await expect(subject.canActivate(route() as never, { url: '/pages/dashboard' } as never)).resolves.toBe(false);
		expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
			queryParams: { returnUrl: '/pages/dashboard' }
		});
	});

	it('never names a sign-in page as the page to come back to', async () => {
		const { guard: subject, router } = guard(async () => false);
		const nested = `/auth/login?returnUrl=${encodeURIComponent('/pages/tasks')}`;

		await subject.canActivate(route() as never, { url: nested } as never);

		expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], { queryParams: { returnUrl: '/pages/tasks' } });
	});

	it('still reaches the sign-in page when the clean-up of the old session fails', async () => {
		const { guard: subject, router } = guard(
			async () => false,
			() => throwError(() => new Error('logout failed'))
		);

		await expect(subject.canActivate(route() as never, { url: '/pages/dashboard' } as never)).resolves.toBe(false);
		expect(router.navigate).toHaveBeenCalledTimes(1);
	});

	it('CONTROL: lets a signed-in session through', async () => {
		const { guard: subject, router } = guard(async () => true);

		await expect(subject.canActivate(route() as never, { url: '/pages/dashboard' } as never)).resolves.toBe(true);
		expect(router.navigate).not.toHaveBeenCalled();
	});
});
