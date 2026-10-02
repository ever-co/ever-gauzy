import '../core/entities/internal';

import { environment } from '@gauzy/config';
import { EmailConfirmationService } from './email-confirmation.service';

/**
 * The verification email carries a token that proves control of the mailbox. A caller-supplied
 * `appEmailConfirmationUrl` (Ever Teams sends its own `/verify-email` page) is honoured only on an
 * origin the deployment serves; otherwise the configured confirmation page is used.
 */
describe('EmailConfirmationService.sendEmailVerification - confirmation link', () => {
	const TEAMS = 'https://app.ever.team';
	const configured = environment.appIntegrationConfig;
	const savedAllowList = process.env['EMAIL_LINK_ALLOWED_ORIGINS'];
	const user = { id: 'user-1', email: 'new+tag@ever.co' } as any;

	let service: EmailConfirmationService;
	let emailVerification: jest.Mock;

	beforeEach(() => {
		process.env['EMAIL_LINK_ALLOWED_ORIGINS'] = TEAMS;
		emailVerification = jest.fn(async () => true);
		service = new EmailConfirmationService(
			{ emailVerification } as any,
			{ update: jest.fn(async () => undefined) } as any,
			{ isFeatureEnabled: jest.fn(async () => true) } as any,
			{ hash: jest.fn(async () => 'hashed') } as any
		);
		(service as any).logger = { warn: jest.fn(), error: jest.fn(), log: jest.fn() };
	});

	afterEach(() => {
		if (savedAllowList === undefined) delete process.env['EMAIL_LINK_ALLOWED_ORIGINS'];
		else process.env['EMAIL_LINK_ALLOWED_ORIGINS'] = savedAllowList;
	});

	async function linkFor(integration: Record<string, unknown>) {
		await service.sendEmailVerification(user, integration as any);
		expect(emailVerification).toHaveBeenCalledTimes(1);
		const [, verificationLink, , appIntegration] = emailVerification.mock.calls[0];
		return { link: verificationLink as string, appIntegration };
	}

	it('keeps a confirmation page on an origin the deployment serves', async () => {
		const { link } = await linkFor({ appEmailConfirmationUrl: `${TEAMS}/verify-email` });

		expect(link.startsWith(`${TEAMS}/verify-email?email=${encodeURIComponent(user.email)}&token=`)).toBe(true);
	});

	it.each([
		['foreign origin', 'https://attacker.example/verify-email'],
		['javascript: URL', 'javascript:alert(1)'],
		['protocol-relative URL', '//attacker.example/verify-email'],
		['user-info trick', `https://app.ever.team@attacker.example/verify-email`],
		['malformed URL', 'http://']
	])('uses the configured confirmation page for a %s', async (_label, appEmailConfirmationUrl) => {
		const { link, appIntegration } = await linkFor({
			appEmailConfirmationUrl,
			appLink: 'https://attacker.example/'
		});

		expect(
			link.startsWith(`${configured.appEmailConfirmationUrl}?email=${encodeURIComponent(user.email)}&token=`)
		).toBe(true);
		expect(link).not.toContain('attacker.example');
		expect(appIntegration.appLink).toBe(configured.appLink);
		expect((service as any).logger.warn).toHaveBeenCalled();
	});
});
