import '../core/entities/internal';

import { environment as env } from '@gauzy/config';
import { LanguagesEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { EmailService } from './email.service';

/**
 * A contributor running the API locally often has no working mail server. Every email that carries a code or a
 * link prints it on the console before the send, on a local development instance only: NODE_ENV=development on a
 * non-production build, with the API and the app served from this machine. Anywhere else nothing reaches the logs.
 */
describe('EmailService - codes and links on the console of a local development instance', () => {
	const ENGLISH = LanguagesEnum.ENGLISH;
	const LOCAL_API = 'http://localhost:3000';
	const LOCAL_APP = 'http://localhost:4200';
	const SIGN_IN_LINK = `${LOCAL_APP}/#/auth/magic-sign-in?email=person%40ever.co&code=SIGNIN1`;
	const VERIFICATION_LINK = `${LOCAL_APP}/#/auth/confirm-email?email=person%40ever.co&token=VERIFY2`;
	const RESET_LINK = `${LOCAL_APP}/#/auth/reset-password?token=RESET1&email=person%40ever.co`;
	const RESET_LINK_TENANT_A = `${LOCAL_APP}/#/auth/reset-password?token=RESET2&email=person%40ever.co&tenantId=a`;
	const RESET_LINK_TENANT_B = `${LOCAL_APP}/#/auth/reset-password?token=RESET3&email=person%40ever.co&tenantId=b`;
	const USER_INVITE_LINK = `${LOCAL_APP}/#/auth/accept-invite?email=new%40ever.co&token=INVITE1`;
	const EMPLOYEE_INVITE_LINK = `${LOCAL_APP}/#/auth/accept-invite?email=new%40ever.co&token=INVITE2`;
	const TEAM_INVITE_LINK = `${LOCAL_APP}/#/auth/accept-invite?email=new%40ever.co&code=TEAM1`;
	const CLIENT_INVITE_LINK = `${LOCAL_APP}#/auth/accept-client-invite?email=client@ever.co&token=CLIENT1`;
	const DELETION_LINK = `${LOCAL_APP}/#/auth/delete-account#token=DELETE1`;
	/** Every code and token below: none of them may reach a log line outside local development. */
	const SECRETS = [
		'SIGNIN1',
		'VERIFY1',
		'VERIFY2',
		'RESET1',
		'RESET2',
		'RESET3',
		'INVITE1',
		'INVITE2',
		'TEAM1',
		'CLIENT1',
		'CHANGE1',
		'JOIN1',
		'DELETE1'
	];

	const user = { id: 'user-1', email: 'person@ever.co', firstName: 'P', lastName: 'Q', name: 'P Q' } as any;
	const organization = { id: 'org-1', tenantId: 'tenant-1', name: 'Org' } as any;

	/** One send per email: what it is, how it is sent, and the lines it prints on a local development instance. */
	const flows: Array<[string, (emails: EmailService) => Promise<unknown>, string[]]> = [
		[
			'the sign-in code email',
			(emails) =>
				emails.sendMagicLoginCode({
					email: 'person@ever.co',
					magicCode: 'SIGNIN1',
					magicLink: SIGN_IN_LINK,
					locale: ENGLISH,
					integration: env.appIntegrationConfig
				}),
			['[DEV] Sign-in code for person@ever.co: SIGNIN1', `[DEV] Sign-in link for person@ever.co: ${SIGN_IN_LINK}`]
		],
		[
			'the email verification email',
			(emails) => emails.emailVerification(user, VERIFICATION_LINK, 'VERIFY1', env.appIntegrationConfig),
			[
				'[DEV] Email verification code for person@ever.co: VERIFY1',
				`[DEV] Email verification link for person@ever.co: ${VERIFICATION_LINK}`
			]
		],
		[
			'the password reset email',
			(emails) => emails.requestPassword(user, RESET_LINK, ENGLISH),
			[`[DEV] Password reset link for person@ever.co: ${RESET_LINK}`]
		],
		[
			'the password reset email of several workspaces',
			(emails) =>
				emails.multiTenantResetPassword(
					'person@ever.co',
					[
						{ resetLink: RESET_LINK_TENANT_A, tenant: { id: 'a', name: 'A' } as any, user },
						{ resetLink: RESET_LINK_TENANT_B, tenant: { id: 'b', name: 'B' } as any, user }
					],
					ENGLISH,
					undefined
				),
			[
				`[DEV] Password reset link for person@ever.co: ${RESET_LINK_TENANT_A}`,
				`[DEV] Password reset link for person@ever.co: ${RESET_LINK_TENANT_B}`
			]
		],
		[
			'the user invitation email',
			(emails) =>
				emails.inviteUser({
					email: 'new@ever.co',
					role: 'EMPLOYEE',
					organization,
					registerUrl: USER_INVITE_LINK,
					languageCode: ENGLISH
				} as any),
			[`[DEV] Invitation link for new@ever.co: ${USER_INVITE_LINK}`]
		],
		[
			'the employee invitation email',
			(emails) =>
				emails.inviteEmployee({
					email: 'new@ever.co',
					organization,
					registerUrl: EMPLOYEE_INVITE_LINK,
					languageCode: ENGLISH
				} as any),
			[`[DEV] Invitation link for new@ever.co: ${EMPLOYEE_INVITE_LINK}`]
		],
		[
			'the team invitation email',
			(emails) =>
				emails.inviteTeamMember({
					email: 'new@ever.co',
					organization,
					inviteCode: 'TEAM1',
					inviteLink: TEAM_INVITE_LINK,
					teams: 'Team',
					languageCode: ENGLISH
				} as any),
			[
				'[DEV] Team invitation code for new@ever.co: TEAM1',
				`[DEV] Team invitation link for new@ever.co: ${TEAM_INVITE_LINK}`
			]
		],
		[
			'the client invitation email',
			(emails) =>
				emails.inviteOrganizationContact(
					{ id: 'contact-1', name: 'C', primaryEmail: 'client@ever.co' } as any,
					user,
					organization,
					{ token: 'CLIENT1' } as any,
					ENGLISH
				),
			[`[DEV] Client invitation link for client@ever.co: ${CLIENT_INVITE_LINK}`]
		],
		[
			'the address change email',
			(emails) => emails.emailReset({ ...user, email: 'new-address@ever.co' }, ENGLISH, 'CHANGE1', organization),
			['[DEV] Email change code for new-address@ever.co: CHANGE1']
		],
		[
			'the team join request email',
			(emails) =>
				emails.organizationTeamJoinRequest(
					{ id: 'team-1', name: 'Team' } as any,
					{ id: 'request-1', email: 'requester@ever.co', code: 'JOIN1' } as any,
					ENGLISH,
					organization,
					{ appName: 'Ever Teams' } as any
				),
			['[DEV] Team join request code for requester@ever.co: JOIN1']
		],
		[
			'the account deletion email',
			(emails) =>
				emails.sendAccountDeletionLink({
					email: 'person@ever.co',
					deletionLink: DELETION_LINK,
					expiresInMinutes: 30,
					locale: ENGLISH,
					integration: env.appIntegrationConfig
				}),
			[`[DEV] Account deletion link for person@ever.co: ${DELETION_LINK}`]
		]
	];

	const savedNodeEnv = process.env.NODE_ENV;
	const savedProduction = env.production;
	const savedApiUrl = env.baseUrl;
	const savedAppUrl = env.clientBaseUrl;

	let service: EmailService;
	let send: jest.Mock;
	let getEmailInstance: jest.Mock;
	let logger: { log: jest.Mock; debug: jest.Mock; warn: jest.Mock; error: jest.Mock };

	function setNodeEnv(nodeEnv: string | undefined): void {
		if (nodeEnv === undefined) {
			delete process.env.NODE_ENV;
			return;
		}
		process.env.NODE_ENV = nodeEnv;
	}

	function runAs(nodeEnv: string | undefined, production: boolean, apiUrl = LOCAL_API, appUrl = LOCAL_APP): void {
		setNodeEnv(nodeEnv);
		(env as { production: boolean }).production = production;
		env.baseUrl = apiUrl;
		env.clientBaseUrl = appUrl;
	}

	async function sendEveryEmail(): Promise<void> {
		for (const [, sendIt] of flows) {
			await sendIt(service);
		}
	}

	/** The lines printed for the developer, in order. */
	function printedLines(): string[] {
		const lines = logger.log.mock.calls.map(([line]) => String(line));
		return lines.filter((line) => line.startsWith('[DEV]'));
	}

	/** Every argument the service gave its logger, at every level. */
	function everythingLogged(): string {
		const methods = [logger.log, logger.debug, logger.warn, logger.error];
		const calls = methods.flatMap((method) => method.mock.calls);
		return JSON.stringify(calls);
	}

	function expectNothingPrinted(): void {
		const logged = everythingLogged();
		expect(logged).not.toContain('[DEV]');
		for (const secret of SECRETS) {
			expect(logged).not.toContain(secret);
		}
	}

	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');

		send = jest.fn(async () => ({ originalMessage: { subject: 's', html: 'h' } }));
		const instance = { send };
		getEmailInstance = jest.fn(async () => instance);
		service = new EmailService(
			{ save: jest.fn(async (entity: unknown) => entity) } as any,
			{ findOneBy: jest.fn(async () => ({ id: 'template-1' })) } as any,
			{ findOneBy: jest.fn(async () => organization) } as any,
			{ getEmailInstance, getInstance: jest.fn(async () => instance) } as any
		);
		logger = { log: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
		(service as any).logger = logger;
	});

	afterEach(() => {
		jest.restoreAllMocks();
		setNodeEnv(savedNodeEnv);
		(env as { production: boolean }).production = savedProduction;
		env.baseUrl = savedApiUrl;
		env.clientBaseUrl = savedAppUrl;
	});

	it.each(flows)('%s prints its code or link on a local development instance', async (_name, sendIt, lines) => {
		runAs('development', false);

		await sendIt(service);

		expect(send).toHaveBeenCalledTimes(1);
		expect(printedLines()).toEqual(lines);
	});

	it.each(['production', 'staging', 'test', undefined])('prints nothing when NODE_ENV is %s', async (nodeEnv) => {
		runAs(nodeEnv, false);

		await sendEveryEmail();

		expect(send).toHaveBeenCalledTimes(flows.length);
		expectNothingPrinted();
	});

	it('prints nothing on a production build, even with NODE_ENV=development', async () => {
		runAs('development', true);

		await sendEveryEmail();

		expect(send).toHaveBeenCalledTimes(flows.length);
		expectNothingPrinted();
	});

	it('prints nothing on a development instance behind public URLs, like the public demo', async () => {
		runAs('development', false, 'https://apidemo.gauzy.co', 'https://demo.gauzy.co');

		await sendEveryEmail();

		expect(send).toHaveBeenCalledTimes(flows.length);
		expectNothingPrinted();
	});

	it('prints the code before the send, so it shows when the send fails', async () => {
		runAs('development', false);
		getEmailInstance.mockRejectedValue(new Error('SMTP down'));

		await service.sendMagicLoginCode({
			email: 'person@ever.co',
			magicCode: 'SIGNIN1',
			magicLink: undefined,
			locale: ENGLISH,
			integration: env.appIntegrationConfig
		});

		expect(send).not.toHaveBeenCalled();
		expect(printedLines()).toEqual(['[DEV] Sign-in code for person@ever.co: SIGNIN1']);
	});

	it('prints the code for an address on a blocked domain, which gets no email', async () => {
		runAs('development', false);

		await service.sendMagicLoginCode({
			email: 'person@example.com',
			magicCode: 'SIGNIN1',
			magicLink: undefined,
			locale: ENGLISH,
			integration: env.appIntegrationConfig
		});

		expect(send).not.toHaveBeenCalled();
		expect(printedLines()).toEqual(['[DEV] Sign-in code for person@example.com: SIGNIN1']);
	});
});
