import { environment } from '@gauzy/config';
import { LoginAttemptService } from '@gauzy/core';
import { OAuthUserService } from './oauth-user.service';

/**
 * The MCP OAuth login form (mcpauth) checks Gauzy passwords against the production database. It had no per-account
 * failure counter, only a per-address rate limit: a guesser spreading attempts over many addresses could try
 * passwords for any email without end. Failures now count in the counter the API's own login uses.
 */
describe('OAuthUserService.authenticateMcpUser — failed attempts', () => {
	const EMAIL = 'someone@example.com';
	const MAX = 3;
	const originalMax = environment.AUTH_MAX_FAILED_ATTEMPTS;
	const originalLockout = environment.AUTH_LOCKOUT_SECONDS;

	let verify: jest.Mock;
	let service: OAuthUserService;

	const from = (ip: string) => ({ ip, headers: {}, res: { setHeader: jest.fn() } });

	beforeEach(() => {
		environment.AUTH_MAX_FAILED_ATTEMPTS = MAX;
		environment.AUTH_LOCKOUT_SECONDS = 900;
		verify = jest.fn(async (password: string) => password === 'right-password');
		const users = { findOne: jest.fn(async () => ({ id: 'user-1', email: EMAIL, hash: 'hash' })) };
		service = new OAuthUserService(users as never, { verify } as never, new LoginAttemptService(null));
	});

	afterEach(() => {
		environment.AUTH_MAX_FAILED_ATTEMPTS = originalMax;
		environment.AUTH_LOCKOUT_SECONDS = originalLockout;
	});

	it('signs in with the right password', async () => {
		expect(await service.authenticateMcpUser(EMAIL, 'right-password', from('198.51.100.1'))).toMatchObject({
			id: 'user-1'
		});
	});

	it('blocks the account once guesses from several addresses reach the threshold, without checking a password', async () => {
		for (let i = 0; i < MAX; i++) {
			expect(await service.authenticateMcpUser(EMAIL, `guess-${i}`, from(`198.51.100.${i}`))).toBeNull();
		}
		verify.mockClear();

		const blocked = from('203.0.113.9');
		await expect(service.authenticateMcpUser(EMAIL, 'right-password', blocked)).rejects.toMatchObject({
			status: 429
		});
		expect(verify).not.toHaveBeenCalled();
		expect(blocked.res.setHeader).toHaveBeenCalledWith('Retry-After', '900');
	});

	it('does not let one address lock the account (that address is the rate limit’s)', async () => {
		for (let i = 0; i < MAX * 3; i++) {
			expect(await service.authenticateMcpUser(EMAIL, `guess-${i}`, from('198.51.100.1'))).toBeNull();
		}

		expect(await service.authenticateMcpUser(EMAIL, 'right-password', from('203.0.113.7'))).toMatchObject({
			id: 'user-1'
		});
	});

	it('does not count a database error against the account', async () => {
		const users = { findOne: jest.fn().mockRejectedValue(new Error('database down')) };
		const failing = new OAuthUserService(users as never, { verify } as never, new LoginAttemptService(null));
		jest.spyOn((failing as any).logger, 'error').mockImplementation(() => undefined);

		for (let i = 0; i < MAX * 2; i++) {
			expect(await failing.authenticateMcpUser(EMAIL, 'any', from(`198.51.100.${i}`))).toBeNull();
		}
		users.findOne.mockResolvedValue({ id: 'user-1', email: EMAIL, hash: 'hash' });

		expect(await failing.authenticateMcpUser(EMAIL, 'right-password', from('203.0.113.7'))).toMatchObject({
			id: 'user-1'
		});
	});
});
