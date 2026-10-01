import { environment } from '@gauzy/config';
import { allowedEmailLinkOrigins, isAllowedEmailLink, isEmailLinkCheckDisabled } from './email-link-origin';

describe('email link origin allowlist', () => {
	const clientBaseUrl = environment.clientBaseUrl;
	const own = new URL(clientBaseUrl).origin;

	it('always allows the deployment own web app (CLIENT_BASE_URL)', () => {
		const allowed = allowedEmailLinkOrigins({});
		expect(isAllowedEmailLink(`${clientBaseUrl}/#/auth/confirm-email`, allowed)).toBe(true);
		expect(allowed.has(own.toLowerCase())).toBe(true);
	});

	it('rejects a link on a host the deployment does not serve', () => {
		const allowed = allowedEmailLinkOrigins({});
		expect(isAllowedEmailLink('https://attacker.example/verify-email', allowed)).toBe(false);
		// Same host name in the path or as a subdomain is not the same origin.
		expect(isAllowedEmailLink(`https://attacker.example/${new URL(clientBaseUrl).host}`, allowed)).toBe(false);
		expect(isAllowedEmailLink(`https://${new URL(clientBaseUrl).host}.attacker.example/`, allowed)).toBe(false);
	});

	it('rejects non-http(s) and malformed links', () => {
		const allowed = allowedEmailLinkOrigins({});
		expect(isAllowedEmailLink('javascript:alert(1)', allowed)).toBe(false);
		expect(isAllowedEmailLink('not a url', allowed)).toBe(false);
		expect(isAllowedEmailLink(undefined, allowed)).toBe(false);
	});

	it('adds the origins listed in EMAIL_LINK_ALLOWED_ORIGINS', () => {
		const allowed = allowedEmailLinkOrigins({
			EMAIL_LINK_ALLOWED_ORIGINS: ' https://app.ever.team , https://stage.ever.team/ignored/path,garbage'
		});
		expect(isAllowedEmailLink('https://app.ever.team/verify-email', allowed)).toBe(true);
		expect(isAllowedEmailLink('https://stage.ever.team/verify-email', allowed)).toBe(true);
		expect(isAllowedEmailLink('https://dev.ever.team/verify-email', allowed)).toBe(false);
	});

	it('is only switched off by an explicit "*"', () => {
		expect(isEmailLinkCheckDisabled({ EMAIL_LINK_ALLOWED_ORIGINS: '*' })).toBe(true);
		expect(isEmailLinkCheckDisabled({ EMAIL_LINK_ALLOWED_ORIGINS: ' * ' })).toBe(true);
		expect(isEmailLinkCheckDisabled({})).toBe(false);
		expect(isEmailLinkCheckDisabled({ EMAIL_LINK_ALLOWED_ORIGINS: 'https://*.ever.team' })).toBe(false);
	});
});
