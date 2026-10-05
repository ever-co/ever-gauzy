import '../core/entities/internal';

import { BadRequestException, HttpStatus, Logger, ServiceUnavailableException } from '@nestjs/common';
import { environment } from '@gauzy/config';
import { IUser } from '@gauzy/contracts';
import { EmailConfirmationService } from './email-confirmation.service';

/**
 * The verification link and the resend endpoint.
 *
 * - The link encodes the address, so a plus-addressed user can verify (a raw `+` reads back as a space).
 * - A caller-supplied confirmation URL is only honoured on an origin the deployment serves; otherwise
 *   a resend could point a genuine Gauzy email at someone else's server and hand them the token.
 * - A resend the provider refused is reported (503) instead of answered with "OK".
 */

const USER = { id: 'user-1', email: 'jane+gauzy@corp.co', emailVerifiedAt: null } as unknown as IUser;

function makeService(
	options: { sent?: boolean; sendThrows?: boolean; user?: IUser; stored?: boolean; verified?: boolean } = {}
) {
	const emailService = {
		emailVerification: jest.fn(async () => {
			if (options.sendThrows) throw new Error('boom');
			return options.sent ?? true;
		})
	};
	const userService = {
		storeEmailVerificationCode: jest.fn(async () => options.stored ?? true),
		markEmailAsVerified: jest.fn(async () => options.verified ?? true),
		getIfExists: jest.fn(async () => options.user ?? USER)
	};
	const featureService = { isFeatureEnabled: jest.fn(async () => true) };
	const passwordHashService = { hash: jest.fn(async () => 'hashed') };
	const service = new EmailConfirmationService(
		emailService as any,
		userService as any,
		featureService as any,
		passwordHashService as any
	);
	return { service, emailService, userService };
}

function linkSent(emailService: { emailVerification: jest.Mock }): string {
	return emailService.emailVerification.mock.calls[0][1];
}

describe('EmailConfirmationService', () => {
	beforeEach(() => {
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('sendEmailVerification', () => {
		it('encodes the address in the link so a plus address survives', async () => {
			const { service, emailService } = makeService();

			await expect(service.sendEmailVerification(USER, {})).resolves.toBe(true);

			// Only the query matters here (CLIENT_BASE_URL is unset under jest, so the base is no URL).
			const link = { searchParams: new URLSearchParams(linkSent(emailService).split('?')[1]) };
			expect(link.searchParams.get('email')).toBe('jane+gauzy@corp.co');
			expect(link.searchParams.get('token')).toBeTruthy();
		});

		it('ignores a confirmation URL on a host the deployment does not serve', async () => {
			const { service, emailService } = makeService();

			await service.sendEmailVerification(USER, { appEmailConfirmationUrl: 'https://attacker.example/verify' });

			const link = linkSent(emailService);
			expect(link.startsWith('https://attacker.example')).toBe(false);
			expect(link.startsWith(`${environment.appIntegrationConfig.appEmailConfirmationUrl}?`)).toBe(true);
		});

		it('honours a confirmation URL on the deployment own origin (control)', async () => {
			const { service, emailService } = makeService();
			const own = `${new URL(environment.clientBaseUrl).origin}/verify-email`;

			await service.sendEmailVerification(USER, { appEmailConfirmationUrl: own });

			expect(linkSent(emailService).startsWith(`${own}?email=`)).toBe(true);
		});

		it('honours any URL when the check is switched off with EMAIL_LINK_ALLOWED_ORIGINS=*', async () => {
			const previous = process.env['EMAIL_LINK_ALLOWED_ORIGINS'];
			process.env['EMAIL_LINK_ALLOWED_ORIGINS'] = '*';
			try {
				const { service, emailService } = makeService();
				await service.sendEmailVerification(USER, {
					appEmailConfirmationUrl: 'https://teams.self-hosted.test/v'
				});
				expect(linkSent(emailService).startsWith('https://teams.self-hosted.test/v?')).toBe(true);
			} finally {
				if (previous === undefined) delete process.env['EMAIL_LINK_ALLOWED_ORIGINS'];
				else process.env['EMAIL_LINK_ALLOWED_ORIGINS'] = previous;
			}
		});

		it('reports false (and does not throw) when the send path throws', async () => {
			const { service } = makeService({ sendThrows: true });
			await expect(service.sendEmailVerification(USER, {})).resolves.toBe(false);
		});

		it('stores the link and code bound to the address the message is sent to', async () => {
			const { service, userService } = makeService();

			await service.sendEmailVerification(USER, {});

			expect(userService.storeEmailVerificationCode).toHaveBeenCalledWith(
				USER.id,
				USER.email,
				expect.objectContaining({
					emailToken: 'hashed',
					code: expect.any(String),
					codeExpireAt: expect.any(Date)
				})
			);
		});

		it('sends nothing when the account no longer holds that address', async () => {
			const { service, emailService } = makeService({ stored: false });

			await expect(service.sendEmailVerification(USER, {})).resolves.toBe(false);
			expect(emailService.emailVerification).not.toHaveBeenCalled();
		});
	});

	describe('confirmEmail', () => {
		it('records the confirmation only for the address that was confirmed', async () => {
			const { service, userService } = makeService();

			await service.confirmEmail(USER);

			expect(userService.markEmailAsVerified).toHaveBeenCalledWith(USER.id, USER.email);
		});

		it('answers OK when the confirmation was recorded', async () => {
			const { service } = makeService({ verified: true });

			await expect(service.confirmEmail(USER)).resolves.toEqual({ status: HttpStatus.OK, message: 'OK' });
		});

		it('fails when the account no longer holds the confirmed address (nothing was recorded)', async () => {
			const { service } = makeService({ verified: false });

			await expect(service.confirmEmail(USER)).rejects.toBeInstanceOf(BadRequestException);
		});

		it('fails when the confirmation could not be written', async () => {
			const { service, userService } = makeService();
			userService.markEmailAsVerified.mockRejectedValueOnce(new Error('connection reset'));

			await expect(service.confirmEmail(USER)).rejects.toBeInstanceOf(BadRequestException);
		});
	});

	describe('resendConfirmationLink', () => {
		it('answers OK when the provider took the message', async () => {
			const { service } = makeService({ sent: true });
			await expect(service.resendConfirmationLink({})).resolves.toEqual({ status: HttpStatus.OK, message: 'OK' });
		});

		it('reports a refused send as 503 instead of claiming it went out', async () => {
			const { service } = makeService({ sent: false });
			await expect(service.resendConfirmationLink({})).rejects.toBeInstanceOf(ServiceUnavailableException);
		});

		it('still refuses an already verified address with 400', async () => {
			const { service, emailService } = makeService({
				user: { ...USER, emailVerifiedAt: new Date() } as unknown as IUser
			});
			await expect(service.resendConfirmationLink({})).rejects.toBeInstanceOf(BadRequestException);
			expect(emailService.emailVerification).not.toHaveBeenCalled();
		});
	});

	describe('getVerificationStatus', () => {
		it('reports an unverified user as not verified', async () => {
			const { service } = makeService();
			await expect(service.getVerificationStatus()).resolves.toEqual({ isEmailVerified: false });
		});

		it('reports a verified user as verified (control)', async () => {
			const { service } = makeService({ user: { ...USER, emailVerifiedAt: new Date() } as unknown as IUser });
			await expect(service.getVerificationStatus()).resolves.toEqual({ isEmailVerified: true });
		});

		it('never exposes anything but the flag', async () => {
			const { service } = makeService();
			expect(Object.keys(await service.getVerificationStatus())).toEqual(['isEmailVerified']);
		});
	});
});
