import '../core/entities/internal';

import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginAttempt, LoginAttemptScope } from './login-attempt.service';

/**
 * How `AuthService` settles the per-account attempt it opens for each credential check.
 *
 * Only a verdict on the credential may count against the account. Counting everything that reached
 * the `catch` — as the first cut of the control did — meant a database blip during a burst of real
 * logins filled the account's failure streak, and a lockout then followed from an outage rather than
 * from guessing.
 */
describe('AuthService per-account attempt settlement', () => {
	let attempt: { [K in keyof LoginAttempt]: jest.Mock };
	let loginAttemptService: { begin: jest.Mock };
	let service: AuthService;

	beforeEach(() => {
		attempt = {
			fail: jest.fn(async () => undefined),
			succeed: jest.fn(async () => undefined),
			release: jest.fn(async () => undefined)
		};
		loginAttemptService = { begin: jest.fn(async () => attempt) };

		// Only the collaborators these paths touch; the rest of the constructor graph is irrelevant here.
		service = Object.create(AuthService.prototype);
		Object.assign(service, {
			loginAttemptService,
			logger: { error: jest.fn(), warn: jest.fn(), log: jest.fn() },
			passwordHashService: { verify: jest.fn(async () => false), needsRehash: jest.fn(() => false) }
		});
	});

	describe('login', () => {
		it('counts a wrong password as a failure', async () => {
			Object.assign(service, {
				userService: { find: jest.fn(async () => [{ id: 'u1', hash: 'h' }]) }
			});

			await expect(service.login({ email: 'victim@ever.co', password: 'guess' })).rejects.toBeInstanceOf(
				UnauthorizedException
			);

			expect(loginAttemptService.begin).toHaveBeenCalledWith(LoginAttemptScope.PASSWORD, 'victim@ever.co');
			expect(attempt.fail).toHaveBeenCalledTimes(1);
			expect(attempt.release).not.toHaveBeenCalled();
		});

		it('counts an unknown email as a failure', async () => {
			Object.assign(service, { userService: { find: jest.fn(async () => []) } });

			await expect(service.login({ email: 'nobody@ever.co', password: 'guess' })).rejects.toBeInstanceOf(
				UnauthorizedException
			);

			expect(attempt.fail).toHaveBeenCalledTimes(1);
		});

		it('does not count an infrastructure error, but still answers 401', async () => {
			Object.assign(service, {
				userService: { find: jest.fn(async () => Promise.reject(new Error('connection terminated'))) }
			});

			await expect(service.login({ email: 'victim@ever.co', password: 'secret' })).rejects.toBeInstanceOf(
				UnauthorizedException
			);

			expect(attempt.fail).not.toHaveBeenCalled();
			expect(attempt.release).toHaveBeenCalledTimes(1);
		});
	});

	describe('signinWorkspacesByEmailPassword', () => {
		it('counts a wrong password as a failure', async () => {
			Object.assign(service, {
				userService: { find: jest.fn(async () => [{ id: 'u1', hash: 'h' }]) }
			});

			await expect(
				service.signinWorkspacesByEmailPassword({ email: 'victim@ever.co', password: 'guess' }, false)
			).rejects.toBeInstanceOf(UnauthorizedException);

			expect(attempt.fail).toHaveBeenCalledTimes(1);
		});

		it('gives the slot back when the user lookup itself fails', async () => {
			const outage = new Error('connection terminated');
			Object.assign(service, { userService: { find: jest.fn(async () => Promise.reject(outage)) } });

			await expect(
				service.signinWorkspacesByEmailPassword({ email: 'victim@ever.co', password: 'secret' }, false)
			).rejects.toBe(outage);

			expect(attempt.fail).not.toHaveBeenCalled();
			expect(attempt.release).toHaveBeenCalledTimes(1);
		});
	});

	describe('signinWorkspacesByMagicCode', () => {
		it('counts a missing code as a failure', async () => {
			await expect(
				service.signinWorkspacesByMagicCode({ email: 'victim@ever.co', code: '' } as any, false)
			).rejects.toBeInstanceOf(UnauthorizedException);

			expect(loginAttemptService.begin).toHaveBeenCalledWith(LoginAttemptScope.MAGIC_CODE, 'victim@ever.co');
			expect(attempt.fail).toHaveBeenCalledTimes(1);
		});

		it('does not count a lookup that failed for infrastructure reasons', async () => {
			Object.assign(service, {
				ormType: 'typeorm',
				typeOrmUserRepository: { find: jest.fn(async () => Promise.reject(new Error('connection terminated'))) }
			});

			await expect(
				service.signinWorkspacesByMagicCode({ email: 'victim@ever.co', code: 'ABC123' } as any, false)
			).rejects.toBeInstanceOf(UnauthorizedException);

			expect(attempt.fail).not.toHaveBeenCalled();
			expect(attempt.release).toHaveBeenCalledTimes(1);
		});
	});
});
