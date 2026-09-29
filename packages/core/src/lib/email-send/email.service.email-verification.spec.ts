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
