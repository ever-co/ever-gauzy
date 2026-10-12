import '../core/entities/internal';

import { environment as env } from '@gauzy/config';
import { LanguagesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { EmailService } from './email.service';

/**
 * Every email that builds links on a caller-supplied base URL (the request's `Origin` header or an
 * `originalUrl`), or renders caller-supplied footer links (`appLink`, `companyLink`), now accepts
 * them only on an origin the deployment serves and otherwise uses its own configured value.
 */
describe('EmailService - caller-supplied links', () => {
	const TEAMS = 'https://app.ever.team';
	const FOREIGN = 'https://attacker.example';
	const configured = env.appIntegrationConfig;
	const savedAllowList = process.env['EMAIL_LINK_ALLOWED_ORIGINS'];

	let service: EmailService;
	let send: jest.Mock;
	let warn: jest.Mock;

	beforeEach(() => {
		process.env['EMAIL_LINK_ALLOWED_ORIGINS'] = TEAMS;
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');

		send = jest.fn(async () => ({ originalMessage: { subject: 's', html: 'h' } }));
		const instance = { send };
		service = new EmailService(
			{ save: jest.fn(async (entity: unknown) => entity) } as any,
			{ findOneBy: jest.fn(async () => ({ id: 'template-1' })) } as any,
			{ findOneBy: jest.fn(async () => ({ id: 'org-1', tenantId: 'tenant-1', name: 'Org' })) } as any,
			{ getEmailInstance: jest.fn(async () => instance), getInstance: jest.fn(async () => instance) } as any
		);
		warn = jest.fn();
		(service as any).logger = { warn, error: jest.fn(), log: jest.fn() };
	});

	afterEach(() => {
		jest.restoreAllMocks();
		if (savedAllowList === undefined) delete process.env['EMAIL_LINK_ALLOWED_ORIGINS'];
		else process.env['EMAIL_LINK_ALLOWED_ORIGINS'] = savedAllowList;
	});

	/** The `locals` handed to the template engine by the only send of the test. */
	function locals(): Record<string, any> {
		expect(send).toHaveBeenCalledTimes(1);
		return send.mock.calls[0][0].locals;
	}

	const user = { id: 'user-1', email: 'person@ever.co', firstName: 'P', lastName: 'Q', name: 'P Q' } as any;
	const organization = { id: 'org-1', tenantId: 'tenant-1', name: 'Org' } as any;

	describe('welcome email', () => {
		it('keeps an origin and footer links the deployment serves', async () => {
			await service.welcomeUser(user, LanguagesEnum.ENGLISH, undefined, TEAMS, {
				appLink: `${TEAMS}/`,
				appName: 'Ever Teams'
			});

			expect(locals().host).toBe(TEAMS);
			expect(locals().appLink).toBe(`${TEAMS}/`);
			expect(locals().appName).toBe('Ever Teams');
		});

		it('uses CLIENT_BASE_URL and the configured links instead of foreign ones', async () => {
			await service.welcomeUser(user, LanguagesEnum.ENGLISH, undefined, FOREIGN, {
				appLink: `${FOREIGN}/`,
				companyLink: 'javascript:alert(1)',
				appEmailConfirmationUrl: '//attacker.example/verify'
			});

			expect(locals().host).toBe(env.clientBaseUrl);
			expect(locals().appLink).toBe(configured.appLink);
			expect(locals().companyLink).toBe(configured.companyLink);
			expect(locals().appEmailConfirmationUrl).toBe(configured.appEmailConfirmationUrl);
			expect(JSON.stringify(locals())).not.toContain('attacker.example');
		});
	});

	describe('password reset emails (anonymous, Origin header)', () => {
		it('ignore a foreign Origin', async () => {
			await service.requestPassword(
				user,
				`${env.clientBaseUrl}/#/auth/reset-password?token=t`,
				LanguagesEnum.ENGLISH,
				FOREIGN
			);
			expect(locals().host).toBe(env.clientBaseUrl);
		});

		it('keep an Origin the deployment serves', async () => {
			await service.multiTenantResetPassword('person@ever.co', [], LanguagesEnum.ENGLISH, TEAMS);
			expect(locals().host).toBe(TEAMS);
		});
	});

	describe('emails that build their links on the Origin', () => {
		it('estimate accept / reject links', async () => {
			await service.emailInvoice(
				LanguagesEnum.ENGLISH,
				'client@ever.co',
				'cGRm',
				1,
				'invoice-1',
				true,
				'tok',
				FOREIGN,
				organization
			);

			expect(locals().acceptUrl.startsWith(`${env.clientBaseUrl}#/auth/estimate/`)).toBe(true);
			expect(locals().rejectUrl.startsWith(`${env.clientBaseUrl}#/auth/estimate/`)).toBe(true);
			expect(locals().host).toBe(env.clientBaseUrl);
		});

		it('client invitation link', async () => {
			await service.inviteOrganizationContact(
				{ id: 'contact-1', name: 'C', primaryEmail: 'client@ever.co' } as any,
				user,
				organization,
				{ token: 'tok' } as any,
				LanguagesEnum.ENGLISH,
				'https://app.ever.team.attacker.example'
			);

			expect(locals().generatedUrl.startsWith(`${env.clientBaseUrl}#/auth/accept-client-invite?`)).toBe(true);
		});

		it('keeps an allowed Origin, in its parsed form', async () => {
			await service.inviteOrganizationContact(
				{ id: 'contact-1', name: 'C', primaryEmail: 'client@ever.co' } as any,
				user,
				organization,
				{ token: 'tok' } as any,
				LanguagesEnum.ENGLISH,
				'https://APP.EVER.TEAM/'
			);

			expect(locals().generatedUrl.startsWith(`${TEAMS}#/auth/accept-client-invite?`)).toBe(true);
		});
	});

	describe('invitation and notification emails', () => {
		it.each([
			[
				'inviteUser',
				(s: EmailService, origin: string) =>
					s.inviteUser({
						email: 'new@ever.co',
						role: 'EMPLOYEE',
						organization,
						registerUrl: 'r',
						originUrl: origin,
						languageCode: LanguagesEnum.ENGLISH
					} as any)
			],
			[
				'inviteEmployee',
				(s: EmailService, origin: string) =>
					s.inviteEmployee({
						email: 'new@ever.co',
						organization,
						registerUrl: 'r',
						originUrl: origin,
						languageCode: LanguagesEnum.ENGLISH
					} as any)
			],
			[
				'inviteTeamMember',
				(s: EmailService, origin: string) =>
					s.inviteTeamMember({
						email: 'new@ever.co',
						organization,
						inviteLink: 'l',
						inviteCode: 'c',
						teams: 'T',
						originUrl: origin,
						languageCode: LanguagesEnum.ENGLISH
					} as any)
			],
			[
				'sendAcceptInvitationEmail',
				(s: EmailService, origin: string) =>
					s.sendAcceptInvitationEmail(
						{
							email: 'admin@ever.co',
							organization,
							employee: { user: { firstName: 'E' } },
							languageCode: LanguagesEnum.ENGLISH
						} as any,
						origin
					)
			],
			[
				'sendPaymentReceipt',
				(s: EmailService, origin: string) =>
					s.sendPaymentReceipt(
						LanguagesEnum.ENGLISH,
						'client@ever.co',
						'C',
						1,
						10,
						'USD',
						organization,
						origin
					)
			],
			[
				'sendRejectionEmail',
				(s: EmailService, origin: string) =>
					s.sendRejectionEmail(LanguagesEnum.ENGLISH, 'candidate@ever.co', 'C', organization, origin)
			],
			[
				'sendAppointmentMail',
				(s: EmailService, origin: string) =>
					s.sendAppointmentMail('guest@ever.co', LanguagesEnum.ENGLISH, undefined, origin)
			]
		])('%s uses CLIENT_BASE_URL as host instead of a foreign Origin', async (_name, sendIt) => {
			await sendIt(service, FOREIGN);
			expect(locals().host).toBe(env.clientBaseUrl);
		});
	});

	describe('emails that render caller-supplied integration links', () => {
		it('sign-in code email footer', async () => {
			await service.sendMagicLoginCode({
				email: 'person@ever.co',
				magicCode: 'ABC123',
				magicLink: `${configured.appMagicSignUrl}?email=person%40ever.co&code=ABC123`,
				locale: LanguagesEnum.ENGLISH,
				integration: { ...configured, appLink: `${FOREIGN}/`, companyLink: `${TEAMS}/about` }
			});

			expect(locals().appLink).toBe(configured.appLink);
			expect(locals().companyLink).toBe(`${TEAMS}/about`);
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('appLink'));
		});

		it('team join request email (anonymous endpoint)', async () => {
			await service.organizationTeamJoinRequest(
				{ id: 'team-1', name: 'Team' } as any,
				{ id: 'request-1', email: 'requester@ever.co', code: 'ABC123' } as any,
				LanguagesEnum.ENGLISH,
				organization,
				{ appName: 'Ever Teams', appLink: `${FOREIGN}/login`, companyLink: '//attacker.example' }
			);

			expect(locals().appLink).toBe(configured.appLink);
			expect(locals().companyLink).toBe(configured.companyLink);
			expect(locals().appName).toBe('Ever Teams');
			expect(JSON.stringify(locals())).not.toContain('attacker.example');
		});
	});
});
