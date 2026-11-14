/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service — the entity graph has
 * to finish initializing before anything applies `@IsEmployeeBelongsToOrganization()`. See the note
 * in `time-tracking/time-log/time-log.service.spec.ts`.
 */
import '../core/entities/internal';
import { environment } from '@gauzy/config';
import { IResetPasswordRequest, LanguagesEnum, RolesEnum } from '@gauzy/contracts';
import { MultiORMEnum } from '../core/utils';
import { AuthService } from './auth.service';

/**
 * The page the link of the password reset email opens (`POST /auth/request-password`).
 *
 * A client app that is not the Gauzy web app has its own page for setting a new password (Ever Teams:
 * `/auth/reset-password`), and Gauzy's route, `<client>/#/auth/reset-password`, does not open it. So the
 * request may name that page (`appResetPasswordUrl`), as the sign-in code request names its sign-in page.
 * The link carries the reset token: it only leads to an origin the deployment serves, and the answer to
 * the caller never depends on it.
 */
describe('AuthService.requestResetPassword - the page of the reset link', () => {
	const EMAIL = 'owner+tag@corp.test';
	const TEAMS = 'https://app.ever.team';
	const TEAMS_PAGE = `${TEAMS}/auth/reset-password`;
	const OWN_PAGE = `${environment.clientBaseUrl}/#/auth/reset-password`;
	const TENANT_A = '9a000000-0000-4000-8000-00000000000a';
	const TENANT_B = '9b000000-0000-4000-8000-00000000000b';
	const savedAllowList = process.env['EMAIL_LINK_ALLOWED_ORIGINS'];

	const account = (id: string, tenantId = TENANT_A) => ({
		id,
		email: EMAIL,
		tenantId,
		tenant: { id: tenantId, name: `Tenant ${tenantId.slice(0, 2)}` },
		role: { name: RolesEnum.EMPLOYEE }
	});

	/** The reset request, plus the stubbed collaborators the tests inspect. */
	type ResetRequest = Pick<AuthService, 'requestResetPassword'> & {
		logger: Record<'error' | 'warn' | 'log' | 'debug', jest.Mock>;
		emailService: Record<'requestPassword' | 'multiTenantResetPassword', jest.Mock>;
	};

	/** An AuthService wired with only what the reset request touches. */
	function buildService(users: ReturnType<typeof account>[]): ResetRequest {
		const service = Object.create(AuthService.prototype);
		Object.defineProperty(service, 'ormType', { get: () => MultiORMEnum.TypeORM });
		service.logger = { error: jest.fn(), warn: jest.fn(), log: jest.fn(), debug: jest.fn() };
		service.fetchUsers = jest.fn(async () => users);
		service.typeOrmPasswordResetRepository = { delete: jest.fn(async () => ({ affected: 1 })) };
		service.commandBus = { execute: jest.fn(async () => ({ id: 'reset-record', expired: false })) };
		service.emailService = { requestPassword: jest.fn(), multiTenantResetPassword: jest.fn() };
		return service;
	}

	/** The link the single account of the address is sent, for a request naming `appResetPasswordUrl`. */
	async function linkFor(appResetPasswordUrl?: unknown) {
		const service = buildService([account('user-1')]);
		// As the route hands it over, except that a test may put anything in the page
		const body = { email: EMAIL, appResetPasswordUrl } as unknown as IResetPasswordRequest;

		await expect(service.requestResetPassword(body, LanguagesEnum.ENGLISH)).resolves.toBe(true);

		expect(service.emailService.requestPassword).toHaveBeenCalledTimes(1);
		const link: string = service.emailService.requestPassword.mock.calls[0][1];
		return { link, warn: service.logger.warn };
	}

	beforeEach(() => {
		// Stands in for a second front end the deployment serves (Ever Teams on api.ever.team).
		process.env['EMAIL_LINK_ALLOWED_ORIGINS'] = TEAMS;
	});

	afterEach(() => {
		if (savedAllowList === undefined) delete process.env['EMAIL_LINK_ALLOWED_ORIGINS'];
		else process.env['EMAIL_LINK_ALLOWED_ORIGINS'] = savedAllowList;
	});

	it("links to the Gauzy app's page when the request names none (today's behaviour)", async () => {
		const { link, warn } = await linkFor();

		expect(link.startsWith(`${OWN_PAGE}?token=`)).toBe(true);
		expect(link).toContain(`&email=${encodeURIComponent(EMAIL)}&tenantId=${TENANT_A}`);
		expect(warn).not.toHaveBeenCalled();
	});

	it("links to the client app's page when it is on an origin the deployment serves", async () => {
		const { link, warn } = await linkFor(TEAMS_PAGE);

		const url = new URL(link);
		expect(`${url.origin}${url.pathname}`).toBe(TEAMS_PAGE);
		expect(url.hash).toBe('');
		expect(url.searchParams.get('token')).toBeTruthy();
		expect(url.searchParams.get('email')).toBe(EMAIL);
		expect(url.searchParams.get('tenantId')).toBe(TENANT_A);
		expect(warn).not.toHaveBeenCalled();
	});

	it('adds its parameters to a page that already has a query', async () => {
		const { link } = await linkFor(`${TEAMS_PAGE}?from=mail`);

		const url = new URL(link);
		expect(url.searchParams.get('from')).toBe('mail');
		expect(url.searchParams.get('token')).toBeTruthy();
		expect(url.searchParams.get('email')).toBe(EMAIL);
	});

	it('adds its parameters before the fragment of a page whose query comes first', async () => {
		const { link } = await linkFor(`${TEAMS_PAGE}?from=mail#form`);

		const url = new URL(link);
		expect(url.searchParams.get('from')).toBe('mail');
		expect(url.searchParams.get('token')).toBeTruthy();
		expect(url.hash).toBe('#form');
	});

	it('adds its parameters to the route of a hash-routed page that has a query of its own', async () => {
		const { link } = await linkFor(`${TEAMS}/?lang=en#/auth/reset-password`);

		const url = new URL(link);
		expect(url.searchParams.get('lang')).toBe('en');
		expect(url.hash.startsWith('#/auth/reset-password?token=')).toBe(true);
	});

	it('sends a reset token only to a listed origin, even where EMAIL_LINK_ALLOWED_ORIGINS=* opens the other links', async () => {
		const previous = process.env['EMAIL_LINK_ALLOWED_ORIGINS'];
		process.env['EMAIL_LINK_ALLOWED_ORIGINS'] = '*';
		try {
			const { link } = await linkFor('https://attacker.example/reset');

			expect(link.startsWith(`${OWN_PAGE}?token=`)).toBe(true);
			expect(link).not.toContain('attacker.example');
		} finally {
			if (previous === undefined) delete process.env['EMAIL_LINK_ALLOWED_ORIGINS'];
			else process.env['EMAIL_LINK_ALLOWED_ORIGINS'] = previous;
		}
	});

	it("keeps the Gauzy app's page for a page on a foreign origin, without telling the caller", async () => {
		const { link, warn } = await linkFor('https://attacker.example/reset');

		expect(link.startsWith(`${OWN_PAGE}?token=`)).toBe(true);
		expect(link).not.toContain('attacker.example');

		// Logged server side, with the origin only (never the token or the caller's full URL).
		const token = new URLSearchParams(link.slice(link.indexOf('?') + 1)).get('token') as string;
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toContain('appResetPasswordUrl');
		expect(warn.mock.calls[0][0]).toContain('https://attacker.example');
		expect(warn.mock.calls[0][0]).not.toContain('/reset');
		expect(warn.mock.calls[0][0]).not.toContain(token);
	});

	it.each([
		['javascript: URL', 'javascript:alert(1)'],
		['protocol-relative URL', '//attacker.example/reset'],
		['backslash trick', 'https://attacker.example\\@app.ever.team/x'],
		['user-info trick', 'https://app.ever.team@attacker.example/x'],
		['look-alike subdomain', 'https://app.ever.team.attacker.example/x'],
		['data: URL', 'data:text/html,<form action=https://attacker.example>'],
		['relative path', '/auth/reset-password'],
		['malformed URL', 'https://'],
		['non-string value', { toString: () => 'https://attacker.example' }]
	])("keeps the Gauzy app's page for a %s", async (_label, appResetPasswordUrl) => {
		const { link } = await linkFor(appResetPasswordUrl);

		expect(link.startsWith(`${OWN_PAGE}?token=`)).toBe(true);
		expect(link).not.toContain('attacker.example');
	});

	it('does not report an empty page', async () => {
		const { link, warn } = await linkFor('');

		expect(link.startsWith(`${OWN_PAGE}?token=`)).toBe(true);
		expect(warn).not.toHaveBeenCalled();
	});

	it("builds the link of every workspace of the address on the client app's page", async () => {
		const service = buildService([account('user-1', TENANT_A), account('user-2', TENANT_B)]);

		await service.requestResetPassword({ email: EMAIL, appResetPasswordUrl: TEAMS_PAGE }, LanguagesEnum.ENGLISH);

		expect(service.emailService.requestPassword).not.toHaveBeenCalled();
		expect(service.emailService.multiTenantResetPassword).toHaveBeenCalledTimes(1);
		const links: { resetLink: string }[] = service.emailService.multiTenantResetPassword.mock.calls[0][1];
		expect(links.map(({ resetLink }) => new URL(resetLink).searchParams.get('tenantId'))).toEqual([
			TENANT_A,
			TENANT_B
		]);
		for (const { resetLink } of links) {
			expect(resetLink.startsWith(`${TEAMS_PAGE}?token=`)).toBe(true);
		}
	});

	it('answers the same for an address without an account, whatever the page', async () => {
		const service = buildService([]);

		await expect(
			service.requestResetPassword(
				{ email: 'nobody@corp.test', appResetPasswordUrl: 'https://attacker.example/reset' },
				LanguagesEnum.ENGLISH
			)
		).resolves.toBe(true);

		expect(service.emailService.requestPassword).not.toHaveBeenCalled();
		expect(service.emailService.multiTenantResetPassword).not.toHaveBeenCalled();
	});
});
