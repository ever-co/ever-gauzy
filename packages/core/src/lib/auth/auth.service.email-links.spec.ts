import '../core/entities/internal';

import { environment } from '@gauzy/config';
import { LanguagesEnum } from '@gauzy/contracts';
import { AuthService } from './auth.service';

/**
 * The link in the sign-in code email (`POST /auth/signin.email`) may only lead to an origin the
 * deployment serves: any other `appMagicSignUrl` is replaced by the configured sign-in page, and the
 * response to the caller does not change.
 */
describe('AuthService.sendWorkspaceSigninCode - links in the sign-in code email', () => {
	const EMAIL = 'victim+tag@ever.co';
	const TEAMS = 'https://app.ever.team';
	const configured = environment.appIntegrationConfig;
	const savedAllowList = process.env['EMAIL_LINK_ALLOWED_ORIGINS'];

	let service: AuthService;
	let sendMagicLoginCode: jest.Mock;
	let warn: jest.Mock;

	beforeEach(() => {
		// Stands in for a second front end the deployment serves (Ever Teams on api.ever.team).
		process.env['EMAIL_LINK_ALLOWED_ORIGINS'] = TEAMS;

		sendMagicLoginCode = jest.fn(async () => undefined);
		warn = jest.fn();

		// Only the collaborators this path touches; the rest of the constructor graph is irrelevant here.
		service = Object.create(AuthService.prototype);
		Object.assign(service, {
			ormType: 'typeorm',
			typeOrmUserRepository: {
				countBy: jest.fn(async () => 1),
				find: jest.fn(async () => [{ id: 'user-1' }]),
				update: jest.fn(async () => undefined)
			},
			emailService: { sendMagicLoginCode },
			logger: { debug: jest.fn(), warn, error: jest.fn(), log: jest.fn() }
		});
	});

	afterEach(() => {
		if (savedAllowList === undefined) delete process.env['EMAIL_LINK_ALLOWED_ORIGINS'];
		else process.env['EMAIL_LINK_ALLOWED_ORIGINS'] = savedAllowList;
	});

	async function send(body: Record<string, unknown>) {
		await expect(
			service.sendWorkspaceSigninCode({ email: EMAIL, ...body } as any, LanguagesEnum.ENGLISH)
		).resolves.toBeUndefined();
		expect(sendMagicLoginCode).toHaveBeenCalledTimes(1);
		const [{ magicLink, magicCode, integration }] = sendMagicLoginCode.mock.calls[0];
		return { magicLink: magicLink as string, magicCode: magicCode as string, integration };
	}

	it('keeps a sign-in page on an origin the deployment serves', async () => {
		const { magicLink, magicCode } = await send({ appMagicSignUrl: `${TEAMS}/auth/passcode` });

		expect(magicLink).toBe(`${TEAMS}/auth/passcode?email=${encodeURIComponent(EMAIL)}&code=${magicCode}`);
		expect(warn).not.toHaveBeenCalled();
	});

	it('uses the configured sign-in page when none is supplied', async () => {
		const { magicLink, magicCode } = await send({});

		expect(magicLink).toBe(`${configured.appMagicSignUrl}?email=${encodeURIComponent(EMAIL)}&code=${magicCode}`);
	});

	it('replaces a sign-in page on a foreign origin with the configured one, without telling the caller', async () => {
		const { magicLink, magicCode, integration } = await send({
			appMagicSignUrl: 'https://attacker.example/sign-in'
		});

		expect(magicLink).not.toContain('attacker.example');
		expect(magicLink).toBe(`${configured.appMagicSignUrl}?email=${encodeURIComponent(EMAIL)}&code=${magicCode}`);
		expect(integration.appMagicSignUrl).toBe(configured.appMagicSignUrl);

		// Logged server side, with the origin only (never the code or the caller's full URL).
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toContain('appMagicSignUrl');
		expect(warn.mock.calls[0][0]).toContain('https://attacker.example');
		expect(warn.mock.calls[0][0]).not.toContain('/sign-in');
		expect(warn.mock.calls[0][0]).not.toContain(magicCode);
	});

	it.each([
		['javascript: URL', 'javascript:alert(1)'],
		['protocol-relative URL', '//attacker.example/sign-in'],
		['backslash trick', 'https://attacker.example\\@app.ever.team/x'],
		['user-info trick', 'https://app.ever.team@attacker.example/x'],
		['look-alike subdomain', 'https://app.ever.team.attacker.example/x'],
		['data: URL', 'data:text/html,<form action=https://attacker.example>'],
		['relative path', '/auth/passcode'],
		['malformed URL', 'https://'],
		['non-string value', { toString: () => 'https://attacker.example' }]
	])('falls back to the configured sign-in page for a %s', async (_label, appMagicSignUrl) => {
		const { magicLink, magicCode } = await send({ appMagicSignUrl });

		expect(magicLink).toBe(`${configured.appMagicSignUrl}?email=${encodeURIComponent(EMAIL)}&code=${magicCode}`);
		expect(magicLink).not.toContain('attacker.example');
	});

	it('also replaces the footer links (appLink, companyLink) when they point elsewhere', async () => {
		const { integration } = await send({
			appMagicSignUrl: `${TEAMS}/auth/passcode`,
			appLink: 'https://attacker.example/',
			companyLink: 'javascript:alert(1)',
			appName: 'Ever Teams'
		});

		expect(integration.appMagicSignUrl).toBe(`${TEAMS}/auth/passcode`);
		expect(integration.appLink).toBe(configured.appLink);
		expect(integration.companyLink).toBe(configured.companyLink);
		// Branding text is not a link and stays the caller's.
		expect(integration.appName).toBe('Ever Teams');
	});

	it('still answers nothing for an unknown address, whatever the link', async () => {
		Object.assign(service, {
			typeOrmUserRepository: { countBy: jest.fn(async () => 0) }
		});

		await expect(
			service.sendWorkspaceSigninCode(
				{ email: 'nobody@ever.co', appMagicSignUrl: 'https://attacker.example/x' } as any,
				LanguagesEnum.ENGLISH
			)
		).resolves.toBeUndefined();
		expect(sendMagicLoginCode).not.toHaveBeenCalled();
	});
});
