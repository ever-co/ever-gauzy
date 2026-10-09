// cspell:ignore EENVELOPE EAUTH
import '../core/entities/internal';

import { Logger } from '@nestjs/common';
import { EmailStatusEnum, IUser, LanguagesEnum } from '@gauzy/contracts';
import { EmailService } from './email.service';

/**
 * CC01-06: a failed verification send was swallowed by `console.error`, wrote no email_sent row and
 * logged the raw provider error (which carries the recipient address). Every attempt now leaves a
 * row with status SENT / FAILED, the log line names the user id and the provider code but never the
 * address, and the stored row keeps no body (it carries a live token and code).
 */

const USER = {
	id: 'user-1',
	email: 'buyer+gauzy@corp.co',
	firstName: 'Jane',
	lastName: 'Doe',
	preferredLanguage: LanguagesEnum.ENGLISH
} as IUser;

function makeService(options: { getInstance: () => Promise<unknown>; templates?: string[]; saveFails?: boolean }) {
	const saved: any[] = [];
	const historyRepository = {
		save: jest.fn(async (entity: unknown) => {
			if (options.saveFails) throw new Error('db down');
			saved.push(entity);
			return entity;
		})
	};
	const templateRepository = {
		findOneBy: jest.fn(async ({ languageCode }: { languageCode: string }) =>
			(options.templates ?? ['en']).includes(languageCode) ? { id: `tpl-${languageCode}`, languageCode } : null
		)
	};
	const sendService = { getInstance: jest.fn(options.getInstance) };
	const service = new EmailService(
		historyRepository as any,
		templateRepository as any,
		{} as any,
		sendService as any
	);
	return { service, saved, historyRepository, templateRepository, sendService };
}

function sentWith(message: Record<string, unknown>) {
	return async () => ({ send: jest.fn(async () => ({ originalMessage: message })) });
}

describe('EmailService.emailVerification', () => {
	let errorSpy: jest.SpyInstance;
	let warnSpy: jest.SpyInstance;

	beforeEach(() => {
		errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('reports success and records a SENT row with the subject but no body', async () => {
		const { service, saved } = makeService({
			getInstance: sentWith({ subject: 'Verify your email', html: '<a href="...token=SECRET">' })
		});

		await expect(service.emailVerification(USER, 'https://app/link?token=SECRET', 'CODE12', {})).resolves.toBe(
			true
		);

		expect(saved).toHaveLength(1);
		expect(saved[0].status).toBe(EmailStatusEnum.SENT);
		expect(saved[0].name).toBe('Verify your email');
		expect(saved[0].content).toBeUndefined();
		expect(saved[0].email).toBe(USER.email);
		expect(saved[0].user).toBe(USER);
		expect(errorSpy).not.toHaveBeenCalled();
	});

	it('reports a provider rejection as false, records FAILED, and logs no address', async () => {
		const rejection = Object.assign(new Error(`406 Inactive recipient. Found inactive addresses: ${USER.email}.`), {
			code: 'EENVELOPE',
			responseCode: 406,
			command: 'RCPT TO'
		});
		const { service, saved } = makeService({
			getInstance: async () => ({ send: jest.fn(async () => Promise.reject(rejection)) })
		});

		await expect(service.emailVerification(USER, 'link', 'CODE12', {})).resolves.toBe(false);

		expect(saved).toHaveLength(1);
		expect(saved[0].status).toBe(EmailStatusEnum.FAILED);
		expect(errorSpy).toHaveBeenCalledTimes(1);
		const line = String(errorSpy.mock.calls[0][0]);
		expect(line).toContain('user-1');
		expect(line).toContain('responseCode=406');
		expect(line).not.toContain(USER.email);
		expect(line).not.toContain('corp.co');
	});

	it('treats a transport that cannot be obtained as a failure, not a TypeError', async () => {
		const { service, saved } = makeService({
			getInstance: async () => Promise.reject(new Error('The default SMTP transport failed verification'))
		});

		await expect(service.emailVerification(USER, 'link', 'CODE12', {})).resolves.toBe(false);
		expect(saved[0].status).toBe(EmailStatusEnum.FAILED);
	});

	it('records a locale without a template against the English template', async () => {
		const { service, saved, templateRepository } = makeService({
			getInstance: sentWith({ subject: 'Verify your email' }),
			templates: ['en']
		});

		await service.emailVerification(
			{ ...USER, preferredLanguage: LanguagesEnum.SPANISH } as IUser,
			'link',
			'CODE12',
			{}
		);

		expect(templateRepository.findOneBy.mock.calls.map(([where]) => where.languageCode)).toEqual(['es', 'en']);
		expect(saved[0].emailTemplate).toEqual({ id: 'tpl-en', languageCode: 'en' });
	});

	it('does not let a failure to record the row turn a delivered email into an error', async () => {
		const { service } = makeService({ getInstance: sentWith({ subject: 'Verify' }), saveFails: true });

		await expect(service.emailVerification(USER, 'link', 'CODE12', {})).resolves.toBe(true);
		expect(String(errorSpy.mock.calls[0][0])).toContain('Could not record');
	});

	it('does not send to a blocked domain and says so without the address', async () => {
		const { service, saved, sendService } = makeService({ getInstance: sentWith({ subject: 'Verify' }) });

		await expect(
			service.emailVerification({ ...USER, email: 'seed@example.com' } as IUser, 'link', 'CODE12', {})
		).resolves.toBe(false);

		expect(sendService.getInstance).not.toHaveBeenCalled();
		expect(saved).toHaveLength(0);
		expect(String(warnSpy.mock.calls[0][0])).not.toContain('seed@example.com');
	});

	it('asks Postmark not to rewrite the links, so the token is not stored as a click', async () => {
		const send = jest.fn(async () => ({ originalMessage: { subject: 'Verify your email' } }));
		const { service } = makeService({ getInstance: async () => ({ send }) });

		await service.emailVerification(USER, 'https://app/link?token=SECRET', 'CODE12', {});

		const [options] = send.mock.calls[0] as unknown as [{ message: { headers?: Record<string, string> } }];
		expect(options.message.headers).toEqual({ 'X-PM-TrackLinks': 'None' });
	});
});

/**
 * The verification notice may only say "we sent you a link" when a working one went out: the status
 * endpoint looks at the LATEST verification email to the user's current address inside the link's
 * validity window, and counts it only if the provider accepted it. Each attempt replaces the stored
 * token and code before sending, so a failed resend leaves no working link even after an earlier
 * successful one.
 */
describe('EmailService.hasSentVerificationEmail', () => {
	function makeLookupService(findOne: () => Promise<{ status?: EmailStatusEnum } | null>) {
		const historyRepository = { findOne: jest.fn(findOne) };
		const service = new EmailService(historyRepository as any, {} as any, {} as any, {} as any);
		return { service, historyRepository };
	}

	beforeEach(() => {
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('reads the newest verification email to this user and address since the given time', async () => {
		const { service, historyRepository } = makeLookupService(async () => ({ status: EmailStatusEnum.SENT }));
		const since = new Date('2026-09-28T10:00:00Z');

		await expect(service.hasSentVerificationEmail('user-1', 'jane@corp.co', since)).resolves.toBe(true);

		const [{ where, order }] = historyRepository.findOne.mock.calls[0] as unknown as [{ where: any; order: any }];
		expect(where.userId).toBe('user-1');
		expect(where.email).toBe('jane@corp.co');
		expect(where.emailTemplate).toEqual({ name: 'email-verification/html' });
		// Any status: the newest attempt decides, so a FAILED resend must be able to win.
		expect(where.status).toBeUndefined();
		// MoreThanOrEqual(since): a FindOperator carrying the window start.
		expect(where.createdAt.type).toBe('moreThanOrEqual');
		expect(where.createdAt.value).toBe(since);
		expect(order).toEqual({ createdAt: 'DESC' });
	});

	it('answers false when the newest attempt failed, even if an earlier one was sent', async () => {
		const { service } = makeLookupService(async () => ({ status: EmailStatusEnum.FAILED }));
		await expect(service.hasSentVerificationEmail('user-1', 'jane@corp.co', new Date())).resolves.toBe(false);
	});

	it('answers false when no verification email exists in the window (control)', async () => {
		const { service } = makeLookupService(async () => null);
		await expect(service.hasSentVerificationEmail('user-1', 'jane@corp.co', new Date())).resolves.toBe(false);
	});

	it('answers false instead of throwing when the history cannot be read', async () => {
		const { service } = makeLookupService(async () => {
			throw new Error('db down');
		});
		await expect(service.hasSentVerificationEmail('user-1', 'jane@corp.co', new Date())).resolves.toBe(false);
	});
});
