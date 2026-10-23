jest.mock('../environments/environment', () => ({
	environment: {
		debug: false,
		auth: { autoLogin: true, email: 'operator@example.com', password: 'operator-password' }
	}
}));

import { runWithAuthKey } from './auth-context';
import { AuthManager } from './auth-manager';

/** A token the manager reads an expiry from, an hour ahead */
const token = (name: string) =>
	[
		Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
		Buffer.from(JSON.stringify({ sub: name, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url'),
		'signature'
	].join('.');

const AUTO_LOGIN_TOKEN = token('operator');
const OWN_TOKEN = token('caller');

/**
 * Over HTTP and WebSocket a caller with no login of its own fell back to the GAUZY_AUTO_LOGIN account — whoever it
 * was and wherever it connected from. The fallback is now for a caller the transport found on this machine only.
 */
describe('AuthManager — the GAUZY_AUTO_LOGIN account over HTTP and WebSocket', () => {
	const authManager = AuthManager.getInstance();

	beforeAll(async () => {
		authManager.setApiClient({
			post: async (_url: string, credentials: { email: string }) => ({
				token: credentials.email === 'operator@example.com' ? AUTO_LOGIN_TOKEN : OWN_TOKEN,
				refresh_token: 'refresh',
				user: { id: credentials.email }
			}),
			get: async () => ({ tenantId: 'tenant' })
		});
		// The process-wide login: the auto-login account, as the server logs in at startup
		expect(await authManager.initialize()).toBe(true);
	});

	it('keeps the auto-login account for stdio and for a caller on this machine', () => {
		expect(authManager.getAccessToken()).toBe(AUTO_LOGIN_TOKEN);
		expect(runWithAuthKey('session-local', () => authManager.getAccessToken(), { sharesAutoLogin: true })).toBe(
			AUTO_LOGIN_TOKEN
		);
	});

	it('gives a caller from elsewhere no login at all', () => {
		expect(
			runWithAuthKey('session-remote', () => authManager.getAccessToken(), { sharesAutoLogin: false })
		).toBeNull();
		expect(runWithAuthKey('session-remote', () => authManager.isAuthenticated(), { sharesAutoLogin: false })).toBe(
			false
		);
		expect(runWithAuthKey('session-remote', () => authManager.getUserId(), { sharesAutoLogin: false })).toBeNull();
	});

	it('keeps that answer for calls nested in the caller’s', () => {
		const nested = runWithAuthKey(
			'session-remote',
			() => runWithAuthKey('session-remote', () => authManager.getAccessToken()),
			{ sharesAutoLogin: false }
		);
		expect(nested).toBeNull();
	});

	it('lets a caller from elsewhere act once it logs in with its own credentials', async () => {
		const own = await runWithAuthKey(
			'session-remote-own',
			async () => {
				await authManager.login('caller@example.com', 'caller-password');
				return authManager.getAccessToken();
			},
			{ sharesAutoLogin: false }
		);
		expect(own).toBe(OWN_TOKEN);
	});

	it('does not log a caller from elsewhere in as the auto-login account when it names no credentials', async () => {
		// `test_api_connection` calls `login()` with no credentials when the caller is not authenticated: the
		// configured ones filled in, and the remote caller's own key then held the auto-login account's token.
		const result = await runWithAuthKey(
			'session-remote-test-connection',
			async () => ({
				withNone: await authManager.login(),
				withOperatorEmailOnly: await authManager.login('operator@example.com'),
				token: authManager.getAccessToken()
			}),
			{ sharesAutoLogin: false }
		);
		expect(result).toEqual({ withNone: false, withOperatorEmailOnly: false, token: null });
		expect(
			runWithAuthKey('session-remote-test-connection', () => authManager.getAccessToken(), {
				sharesAutoLogin: false
			})
		).toBeNull();
	});

	it('CONTROL: a caller on this machine still logs in as the auto-login account without credentials', async () => {
		const token = await runWithAuthKey(
			'session-local-test-connection',
			async () => {
				expect(await authManager.login()).toBe(true);
				return authManager.getAccessToken();
			},
			{ sharesAutoLogin: true }
		);
		expect(token).toBe(AUTO_LOGIN_TOKEN);
	});
});
