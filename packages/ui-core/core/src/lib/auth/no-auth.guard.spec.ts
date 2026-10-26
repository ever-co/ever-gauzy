// The services barrel reaches the whole client; the guard only needs the classes as injection tokens.
jest.mock('../services', () => ({
	AuthService: class AuthService {},
	Store: class Store {}
}));

import { NoAuthGuard } from './no-auth.guard';

/**
 * Q8d (Greptile on #10888): with a stale stored token, `/auth/login` opened directly ran `isAuthenticated()`, whose
 * failure (refresh failed) rejected the guard — and the refresh interceptor no longer redirects again from an /auth page,
 * so nothing re-ran it: the sign-in form never opened. A failed check is "not signed in".
 */
describe('NoAuthGuard — the sign-in page with a stale session', () => {
	function guard(token: string | null, isAuthenticated: () => Promise<boolean>) {
		const router = { navigate: jest.fn().mockResolvedValue(true) };
		const subject = new NoAuthGuard(
			router as never,
			{ isAuthenticated: jest.fn(isAuthenticated) } as never,
			{
				token
			} as never
		);

		return { router, subject };
	}

	it('opens the sign-in page when the check fails', async () => {
		const { subject, router } = guard('a.stale.token', () => Promise.reject(new Error('refresh failed')));

		await expect(subject.canActivate({} as never, { url: '/auth/login' } as never)).resolves.toBe(true);
		expect(router.navigate).not.toHaveBeenCalled();
	});

	it('opens the sign-in page for a session the API does not recognise', async () => {
		const { subject } = guard('a.stale.token', async () => false);

		await expect(subject.canActivate({} as never, { url: '/auth/login' } as never)).resolves.toBe(true);
	});

	it('CONTROL: sends a signed-in session to the dashboard instead', async () => {
		const { subject, router } = guard('a.valid.token', async () => true);

		await expect(subject.canActivate({} as never, { url: '/auth/login' } as never)).resolves.toBe(false);
		expect(router.navigate).toHaveBeenCalledTimes(1);
	});
});
