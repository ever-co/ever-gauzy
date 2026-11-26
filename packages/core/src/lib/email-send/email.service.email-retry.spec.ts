// cspell:ignore ESOCKET ECONNREFUSED EENVELOPE ECONNECTION JVBE greylisting
import '../core/entities/internal';

import * as Email from 'email-templates';
import { EmailStatusEnum, EmailTemplateEnum, LanguagesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { EmailRetryService } from './email-retry.service';
import { EmailService } from './email.service';

/**
 * A send that fails before the mail server accepted the message schedules one automatic retry on the row it files,
 * with the message it rendered; anything else is filed exactly as before. The `Email` instance is email-templates' own,
 * rendering through a stand-in renderer and sending through a stand-in of nodemailer's SMTP mailer.
 */

const MINUTE = 60_000;
const organization = { id: 'org-1', tenantId: 'tenant-1', name: 'Ever Org' } as any;
const user = {
	id: 'user-1',
	email: 'ada@example.test',
	name: 'Ada',
	firstName: 'Ada',
	tenant: { name: 'Ever' }
} as any;

/** What nodemailer raises when the server refused the connection. */
const refused = () =>
	Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:465'), {
		code: 'ESOCKET',
		originalCode: 'ECONNREFUSED',
		command: 'CONN'
	});
/** A permanent refusal of the address. */
const noSuchUser = () =>
	Object.assign(new Error("Can't send mail - all recipients were rejected: 550 5.1.1 ada@example.test"), {
		code: 'EENVELOPE',
		responseCode: 550,
		command: 'RCPT TO'
	});
/** A connection dropped at a step nodemailer does not name (after the body, for all it says). */
const dropped = () =>
	Object.assign(new Error('Connection closed unexpectedly'), { code: 'ECONNECTION', command: 'CONN' });

/** email-templates' `Email`, sending through a mailer named as nodemailer's SMTP transport is. */
function anEmailInstance(sendMail: jest.Mock, transporterName = 'SMTP', render?: jest.Mock): any {
	return new (Email as any)({
		message: { from: 'noreply@gauzy.test' },
		send: true,
		preview: false,
		transport: { transporter: { name: transporterName }, sendMail },
		views: { options: { extension: 'hbs' } },
		render:
			render ??
			(async (rawView: string, locals: Record<string, any>) => {
				// email-templates joins the view with the platform's path separator, as the real renderer undoes
				const view = rawView.split('\\').join('/');
				if (view.endsWith('/subject')) return `  Subject of ${view.split('/')[0]}  `;
				if (view.endsWith('/html'))
					return (
						`<h1>${view.split('/')[0]}</h1><p>${view.split('/')[0]} for ${locals.organizationName ?? 'you'}</p>` +
						`<p><a href="https://app.gauzy.test/#/pages/dashboard">Open the app</a></p>`
					);
				return '';
			})
	});
}

describe('EmailService: scheduling the automatic retry of a failed email', () => {
	let service: EmailService;
	let sendMail: jest.Mock;
	let instance: any;
	let save: jest.Mock;
	let update: jest.Mock;
	let findOne: jest.Mock;
	let findOrganization: jest.Mock;
	let getEmailInstance: jest.Mock;
	let getInstance: jest.Mock;
	let previousSwitch: string | undefined;

	beforeEach(() => {
		previousSwitch = process.env.EMAIL_RETRY_ENABLED;
		delete process.env.EMAIL_RETRY_ENABLED;
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
		jest.spyOn(RequestContext, 'getLanguageCode').mockReturnValue(LanguagesEnum.ENGLISH);

		sendMail = jest.fn(async (message: any) => ({ messageId: '<m@gauzy.test>', accepted: [message.to] }));
		instance = anEmailInstance(sendMail);
		save = jest.fn(async (entity: any) => ({ ...entity, id: 'row-1' }));
		update = jest.fn(async () => ({ affected: 1 }));
		findOne = jest.fn();
		findOrganization = jest.fn(async () => organization);
		getEmailInstance = jest.fn(async () => instance);
		getInstance = jest.fn(async () => instance);
		service = new EmailService(
			{ save, update, findOne } as any,
			{ findOneBy: jest.fn(async ({ name }: any) => ({ id: 'template-1', name })) } as any,
			{ findOneBy: findOrganization } as any,
			{ getEmailInstance, getInstance } as any
		);
		(service as any).logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn(), debug: jest.fn() };
	});

	afterEach(() => {
		jest.restoreAllMocks();
		if (previousSwitch === undefined) delete process.env.EMAIL_RETRY_ENABLED;
		else process.env.EMAIL_RETRY_ENABLED = previousSwitch;
	});

	const saved = () => save.mock.calls.map(([entity]) => entity);

	/** The four senders whose template is retried, each as its callers call it. */
	const retriedSenders: Array<[string, (service: EmailService) => Promise<unknown>]> = [
		[
			EmailTemplateEnum.WELCOME_USER,
			(it) => it.welcomeUser(user, LanguagesEnum.ENGLISH, 'org-1', 'http://localhost:4200')
		],
		[
			EmailTemplateEnum.EMPLOYEE_JOIN,
			(it) =>
				it.sendAcceptInvitationEmail({
					email: 'manager@example.test',
					employee: { user: { firstName: 'Ada' } },
					organization,
					languageCode: LanguagesEnum.ENGLISH
				} as any)
		],
		[
			EmailTemplateEnum.TIME_SHEET_SUBMIT,
			(it) =>
				it.timesheetSubmit('ada@example.test', {
					id: 'timesheet-1',
					status: 'PENDING',
					employee: { organizationId: 'org-1', user }
				} as any)
		],
		[
			EmailTemplateEnum.ESTIMATE_ANSWERED,
			(it) =>
				it.sendEstimateAnswered({
					languageCode: LanguagesEnum.ENGLISH,
					email: 'creator@example.test',
					user,
					organization,
					invoiceId: 'estimate-1',
					invoiceNumber: 12,
					isAccepted: true
				})
		]
	];

	it.each(retriedSenders)(
		'%s: a send refused before the server took it files the rendered message with one retry due in five minutes',
		async (template, send) => {
			sendMail.mockRejectedValueOnce(refused());
			const transport = instance.config.transport;
			const before = Date.now();

			await send(service);

			expect(sendMail).toHaveBeenCalledTimes(1);
			expect(save).toHaveBeenCalledTimes(1);
			const [row] = saved();
			expect(row).toMatchObject({
				status: EmailStatusEnum.FAILED,
				name: `Subject of ${template}`,
				content: expect.stringContaining(`<p>${template} for`),
				retryCount: 0,
				lastErrorCode: 'ESOCKET ECONNREFUSED CONN',
				tenantId: 'tenant-1',
				organizationId: 'org-1'
			});
			expect(row.nextRetryAt.getTime()).toBeGreaterThanOrEqual(before + 5 * MINUTE);
			expect(row.nextRetryAt.getTime()).toBeLessThanOrEqual(Date.now() + 5 * MINUTE);
			// The message kept is the one the transport was handed, not a second rendering
			expect(row.content).toBe(sendMail.mock.calls[0][0].html);
			expect(row.name).toBe(sendMail.mock.calls[0][0].subject);
			// The instance's transport is its own again
			expect(instance.config.transport).toBe(transport);
		}
	);

	it('a greylisting 450 to RCPT TO is retried as well', async () => {
		sendMail.mockRejectedValueOnce(
			Object.assign(new Error("Can't send mail"), { code: 'EENVELOPE', responseCode: 450, command: 'RCPT TO' })
		);

		await service.welcomeUser(user, LanguagesEnum.ENGLISH, 'org-1');

		expect(saved()[0]).toMatchObject({ retryCount: 0, lastErrorCode: 'EENVELOPE 450 RCPT TO' });
	});

	it.each([
		['a permanent refusal of the address', noSuchUser],
		['a connection dropped at an unknown step', dropped],
		['an error with no SMTP step', () => new Error('SMTP configuration is not set for this tenant / organization')]
	])('%s files the row exactly as before, with no retry', async (_case, error) => {
		sendMail.mockRejectedValueOnce(error());

		await service.welcomeUser(user, LanguagesEnum.ENGLISH, 'org-1');

		const [row] = saved();
		expect(row.status).toBe(EmailStatusEnum.FAILED);
		expect(row.name).toBeUndefined();
		expect(row.content).toBeUndefined();
		expect(row.retryCount).toBeUndefined();
		expect(row.nextRetryAt).toBeUndefined();
		expect(row.lastErrorCode).toBeUndefined();
	});

	it('never schedules a retry for a template outside the allowlist, whatever the error', async () => {
		sendMail.mockRejectedValue(refused());

		await service.requestPassword(user, 'http://localhost:4200/#/auth/reset?token=t', LanguagesEnum.ENGLISH);
		await service.multiTenantResetPassword(
			'ada@example.test',
			[{ resetLink: 'http://localhost:4200/#/auth/reset?token=t', user }],
			LanguagesEnum.ENGLISH,
			'http://localhost:4200'
		);
		await service.sendMagicLoginCode({
			email: 'ada@example.test',
			magicCode: '123456',
			magicLink: 'http://localhost:4200/#/auth/magic?code=123456',
			locale: LanguagesEnum.ENGLISH,
			integration: {}
		} as any);
		await service.emailVerification(user, 'http://localhost:4200/#/auth/verify?token=t', '123456', {} as any);
		await service.emailReset(user, LanguagesEnum.ENGLISH, '123456', organization);
		await service.organizationTeamJoinRequest(
			{ name: 'Team' } as any,
			{ email: 'ada@example.test', code: '123456' } as any,
			LanguagesEnum.ENGLISH,
			organization,
			{} as any
		);
		await service.setTimesheetAction('ada@example.test', {
			id: 'timesheet-1',
			status: 'APPROVED',
			employee: { organizationId: 'org-1', user }
		} as any);
		await service.sendAppointmentMail('ada@example.test', LanguagesEnum.ENGLISH, 'org-1');
		await expect(
			service.inviteUser({
				email: 'ada@example.test',
				role: 'EMPLOYEE',
				organization,
				registerUrl: 'http://localhost:4200/#/auth/accept-invite?token=t',
				languageCode: LanguagesEnum.ENGLISH
			} as any)
		).rejects.toThrow();
		await expect(
			service.emailInvoice(
				LanguagesEnum.ENGLISH,
				'ada@example.test',
				'JVBERi0=',
				1,
				'invoice-1',
				false,
				'token',
				'http://localhost:4200',
				organization
			)
		).rejects.toThrow();

		expect(save).toHaveBeenCalledTimes(10);
		for (const row of saved()) {
			expect(row.status).toBe(EmailStatusEnum.FAILED);
			expect(row.retryCount).toBeUndefined();
			expect(row.nextRetryAt).toBeUndefined();
		}
	});

	it('schedules nothing while EMAIL_RETRY_ENABLED=false', async () => {
		process.env.EMAIL_RETRY_ENABLED = 'false';
		sendMail.mockRejectedValueOnce(refused());

		await service.welcomeUser(user, LanguagesEnum.ENGLISH, 'org-1');

		expect(saved()[0].nextRetryAt).toBeUndefined();
		expect(saved()[0].content).toBeUndefined();
	});

	it("schedules nothing for a provider plugin's transport, whose error says nothing of an SMTP step", async () => {
		sendMail.mockRejectedValueOnce(refused());
		getEmailInstance.mockResolvedValueOnce(anEmailInstance(sendMail, 'Resend'));

		await service.welcomeUser(user, LanguagesEnum.ENGLISH, 'org-1');

		expect(saved()[0].nextRetryAt).toBeUndefined();
	});

	it('schedules nothing when the row would name other mail settings than the send went through', async () => {
		// The organization asked for is not found: the send names it, the row cannot
		findOrganization.mockResolvedValueOnce(null);
		sendMail.mockRejectedValueOnce(refused());

		await service.welcomeUser(user, LanguagesEnum.ENGLISH, 'org-gone');

		expect(saved()[0]).toMatchObject({ status: EmailStatusEnum.FAILED, organizationId: null });
		expect(saved()[0].nextRetryAt).toBeUndefined();
	});

	it('schedules nothing when the message never reached the transport (it could not be rendered)', async () => {
		const render = jest.fn(async () => {
			throw new Error('template not found');
		});
		getEmailInstance.mockResolvedValueOnce(anEmailInstance(sendMail, 'SMTP', render));

		await service.welcomeUser(user, LanguagesEnum.ENGLISH, 'org-1');

		expect(sendMail).not.toHaveBeenCalled();
		expect(saved()[0].nextRetryAt).toBeUndefined();
	});

	it('leaves a send that goes through exactly as it was: the same message, the same result, the same row', async () => {
		await service.welcomeUser(user, LanguagesEnum.ENGLISH, 'org-1');
		const withRetry = { message: sendMail.mock.calls[0][0], row: saved()[0] };

		process.env.EMAIL_RETRY_ENABLED = 'false';
		await service.welcomeUser(user, LanguagesEnum.ENGLISH, 'org-1');
		const without = { message: sendMail.mock.calls[1][0], row: saved()[1] };

		expect(withRetry.message).toEqual(without.message);
		expect(withRetry.row).toEqual(without.row);
		expect(withRetry.row).toMatchObject({ status: EmailStatusEnum.SENT, content: expect.stringContaining('<p>') });
		expect(withRetry.row.retryCount).toBeUndefined();
		expect(withRetry.row.nextRetryAt).toBeUndefined();
		expect(withRetry.row.lastErrorCode).toBeUndefined();
	});

	describe('message parity: what the retry hands the transport is what the original send did', () => {
		it.each(retriedSenders)('%s', async (template, send) => {
			sendMail.mockRejectedValueOnce(refused());
			await send(service);
			const original = sendMail.mock.calls[0][0];
			const [row] = saved();
			expect(row.nextRetryAt).toBeInstanceOf(Date);

			// The sweep's own send, through an instance built for the row's mail settings as `getEmailInstance` builds one
			const retrySendMail = jest.fn(async (_message: Record<string, unknown>) => ({
				messageId: '<retry@gauzy.test>'
			}));
			const retryInstance = anEmailInstance(retrySendMail);
			const getRetryInstance = jest.fn(async () => retryInstance);
			const retries = new EmailRetryService(
				{ update: jest.fn(async () => ({ affected: 1 })) } as any,
				{ getEmailInstance: getRetryInstance } as any
			);
			const report = { due: 1, sent: 0, rescheduled: 0, gaveUp: 0, taken: 0, dropped: 0, capped: false };
			await (retries as any).send(
				{
					...row,
					id: 'row-1',
					retryCount: 0,
					createdAt: new Date(),
					emailTemplate: { name: `${template}/html` }
				},
				report
			);

			expect(report.sent).toBe(1);
			expect(getRetryInstance).toHaveBeenCalledWith({ organizationId: 'org-1', tenantId: 'tenant-1' });
			const retried = retrySendMail.mock.calls[0][0];
			// Every field: the recipient, the subject, the HTML, the text part derived from it, the sender of the mail
			// settings (resolved again) and the empty attachment list. Nothing is dropped for these four templates.
			expect(retried).toEqual(original);
			expect(Object.keys(retried).sort()).toEqual(['attachments', 'from', 'html', 'subject', 'text', 'to']);
			expect(original.text).toContain('Open the app');
		});
	});

	describe('a message a retry would not reproduce is never retried', () => {
		/** `sendKeepingRetry` of a welcome email whose message carries `extra`, failing before acceptance. */
		async function retryOf(extra: Record<string, unknown>, renderer?: jest.Mock) {
			sendMail.mockRejectedValueOnce(refused());
			const body: Record<string, any> = {};
			await expect(
				(service as any).sendKeepingRetry(
					renderer ? anEmailInstance(sendMail, 'SMTP', renderer) : instance,
					{
						template: EmailTemplateEnum.WELCOME_USER,
						message: { to: 'ada@example.test', ...extra },
						locals: {}
					},
					body,
					{ organizationId: 'org-1', tenantId: 'tenant-1' }
				)
			).rejects.toMatchObject({ originalCode: 'ECONNREFUSED' });
			return body.retry;
		}

		it('keeps a retry for the plain message (the control)', async () => {
			expect(await retryOf({})).toMatchObject({ subject: 'Subject of welcome-user', tenantId: 'tenant-1' });
		});

		it.each([
			['headers (link tracking off)', { headers: { 'X-PM-TrackLinks': 'None' } }],
			['a cc', { cc: 'boss@example.test' }],
			['a bcc', { bcc: 'audit@example.test' }],
			['a reply-to', { replyTo: 'support@example.test' }],
			['a sender of its own', { from: 'someone@example.test' }],
			['an attachment', { attachments: [{ filename: 'a.pdf', content: 'JVBERi0=', encoding: 'base64' }] }],
			['several recipients', { to: 'ada@example.test, bob@example.test' }],
			['a list of recipients', { to: ['ada@example.test', 'bob@example.test'] }]
		])('%s', async (_case, extra) => {
			expect(await retryOf(extra)).toBeUndefined();
		});

		it('a text part a template rendered, which the retry would replace by one derived from the HTML', async () => {
			const renderer = jest.fn(async (rawView: string) => {
				const view = rawView.split('\\').join('/');
				if (view.endsWith('/subject')) return 'Welcome';
				if (view.endsWith('/html')) return '<p>Welcome</p>';
				return 'A text part of its own';
			});

			expect(await retryOf({}, renderer)).toBeUndefined();
		});

		it('keeps no value of the fields it refused: the row is filed as any failed send is', async () => {
			sendMail.mockRejectedValueOnce(refused());
			const bcc = 'audit@example.test';
			const options = {
				template: EmailTemplateEnum.WELCOME_USER,
				message: { to: 'ada@example.test', bcc },
				locals: {}
			};
			const body: Record<string, any> = {};

			await expect(
				(service as any).sendKeepingRetry(instance, options, body, {
					organizationId: 'org-1',
					tenantId: 'tenant-1'
				})
			).rejects.toBeDefined();

			expect(JSON.stringify(body)).not.toContain(bcc);
		});
	});

	it('hands the caller what the transport returned', async () => {
		const result = await (service as any).sendKeepingRetry(
			instance,
			{ template: EmailTemplateEnum.WELCOME_USER, message: { to: 'ada@example.test' }, locals: {} },
			{},
			{ organizationId: 'org-1', tenantId: 'tenant-1' }
		);

		expect(result).toMatchObject({ messageId: '<m@gauzy.test>', accepted: ['ada@example.test'] });
		expect(result.originalMessage).toMatchObject({ to: 'ada@example.test', subject: 'Subject of welcome-user' });
	});

	describe('resendEmail', () => {
		const stored = (fields: Record<string, unknown> = {}) => ({
			id: 'row-1',
			tenantId: 'tenant-1',
			email: 'ada@example.test',
			name: 'Welcome',
			content: '<p>Welcome</p>',
			status: EmailStatusEnum.FAILED,
			emailTemplate: { name: 'welcome-user/html' },
			organization,
			...fields
		});

		it('takes an email out of the automatic retries before it re-sends it by hand', async () => {
			const order: string[] = [];
			findOne.mockResolvedValueOnce(stored({ retryCount: 0, nextRetryAt: new Date(Date.now() + MINUTE) }));
			update.mockImplementationOnce(async () => {
				order.push('update');
				return { affected: 1 };
			});
			sendMail.mockImplementationOnce(async () => {
				order.push('send');
				return {};
			});

			await service.resendEmail('row-1', {}, LanguagesEnum.ENGLISH);

			expect(update).toHaveBeenCalledWith({ id: 'row-1' }, { nextRetryAt: null });
			expect(order).toEqual(['update', 'send']);
			expect(save).toHaveBeenCalledWith(
				expect.objectContaining({ status: EmailStatusEnum.SENT, nextRetryAt: null })
			);
		});

		it('writes nothing more for an email that has no retry due', async () => {
			findOne.mockResolvedValueOnce(stored());

			await service.resendEmail('row-1', {}, LanguagesEnum.ENGLISH);

			expect(update).not.toHaveBeenCalled();
			expect(sendMail).toHaveBeenCalledTimes(1);
			expect(save).toHaveBeenCalledWith(expect.objectContaining({ status: EmailStatusEnum.SENT }));
		});
	});
});
