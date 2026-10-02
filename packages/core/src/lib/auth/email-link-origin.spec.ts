/**
 * A fixed configuration, so these cases do not depend on whichever `.env` the runner loaded. It is
 * what the app.gauzy.co API runs with (CLIENT_BASE_URL and APP_MAGIC_SIGN_URL set, the other links
 * derived); `useTeamsDeployment` switches it to the api.ever.team one.
 */
const GAUZY_DEPLOYMENT = {
	clientBaseUrl: 'https://app.gauzy.co',
	appIntegrationConfig: {
		appName: 'Gauzy',
		appLogo: 'https://app.gauzy.co/assets/images/logos/logo_Gauzy.png',
		appSignature: 'Gauzy Team',
		appLink: 'https://app.gauzy.co/',
		appEmailConfirmationUrl: 'https://app.gauzy.co/#/auth/confirm-email',
		appMagicSignUrl: 'https://app.gauzy.co/#/auth/magic-sign-in',
		companyLink: 'https://ever.co',
		companyName: 'Ever Co. LTD'
	}
};
const mockEnvironment = JSON.parse(JSON.stringify(GAUZY_DEPLOYMENT));

jest.mock('@gauzy/config', () => ({ environment: mockEnvironment }));

import { environment } from '@gauzy/config';
import {
	allowedEmailBaseUrl,
	allowedEmailLink,
	allowedEmailLinkOrigins,
	isAllowedEmailLink,
	isEmailLinkCheckDisabled,
	withAllowedEmailLinks
} from './email-link-origin';

afterEach(() => {
	// Restored in place: the module under test holds on to these very objects.
	mockEnvironment.clientBaseUrl = GAUZY_DEPLOYMENT.clientBaseUrl;
	Object.assign(mockEnvironment.appIntegrationConfig, GAUZY_DEPLOYMENT.appIntegrationConfig);
});

/** The api.ever.team deployment: same API code, its own CLIENT_BASE_URL, Gauzy's sign-in page. */
function useTeamsDeployment() {
	mockEnvironment.clientBaseUrl = 'https://app.ever.team';
	mockEnvironment.appIntegrationConfig.appLink = 'https://app.ever.team/';
	mockEnvironment.appIntegrationConfig.appEmailConfirmationUrl = 'https://app.ever.team/#/auth/confirm-email';
	mockEnvironment.appIntegrationConfig.appMagicSignUrl = 'https://app.gauzy.co/#/auth/magic-sign-in';
}

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

	it('includes the configured sign-in, confirmation and app links', () => {
		const allowed = allowedEmailLinkOrigins({});
		for (const configured of [
			environment.appIntegrationConfig.appMagicSignUrl,
			environment.appIntegrationConfig.appEmailConfirmationUrl,
			environment.appIntegrationConfig.appLink
		]) {
			expect(isAllowedEmailLink(configured, allowed)).toBe(true);
		}
		// The company site is a footer link, not a front end: it is not a place a code may be sent to.
		expect(isAllowedEmailLink('https://ever.co/x', allowed)).toBe(false);
		expect([...allowed]).toEqual(['https://app.gauzy.co']);
	});

	it('on the Ever Teams API deployment, allows Ever Teams and its configured sign-in page only', () => {
		useTeamsDeployment();
		const allowed = allowedEmailLinkOrigins({});

		// Ever Teams computes its links from location.origin.
		expect(isAllowedEmailLink('https://app.ever.team/auth/passcode', allowed)).toBe(true);
		expect(isAllowedEmailLink('https://app.ever.team/verify-email', allowed)).toBe(true);
		expect(isAllowedEmailLink('https://app.ever.team/auth/accept-invite', allowed)).toBe(true);
		// Its APP_MAGIC_SIGN_URL points at the Gauzy web app.
		expect(isAllowedEmailLink('https://app.gauzy.co/#/auth/magic-sign-in', allowed)).toBe(true);
		expect(isAllowedEmailLink('https://attacker.example/auth/passcode', allowed)).toBe(false);
		expect(new Set(allowed)).toEqual(new Set(['https://app.ever.team', 'https://app.gauzy.co']));
	});

	it('does not let an unparseable configured link widen the list', () => {
		// What the config produces when CLIENT_BASE_URL is unset: `${undefined}/#/auth/...`.
		mockEnvironment.appIntegrationConfig.appMagicSignUrl = 'undefined/#/auth/magic-sign-in';
		expect([...allowedEmailLinkOrigins({})]).toEqual(['https://app.gauzy.co']);
	});
});

describe('allowedEmailLink', () => {
	const TEAMS = { EMAIL_LINK_ALLOWED_ORIGINS: 'https://app.ever.team' };

	it('keeps a link on an allowed origin', () => {
		expect(allowedEmailLink('https://app.ever.team/auth/passcode', TEAMS)).toBe(
			'https://app.ever.team/auth/passcode'
		);
		expect(allowedEmailLink(`${environment.clientBaseUrl}/#/auth/magic-sign-in`, {})).toBe(
			new URL(`${environment.clientBaseUrl}/#/auth/magic-sign-in`).href
		);
	});

	it('returns the parsed form: lower-case host, no default port, no user info, trimmed', () => {
		expect(allowedEmailLink('https://APP.Ever.Team:443/auth/passcode', TEAMS)).toBe(
			'https://app.ever.team/auth/passcode'
		);
		expect(allowedEmailLink('https://user:secret@app.ever.team/auth/passcode', TEAMS)).toBe(
			'https://app.ever.team/auth/passcode'
		);
		expect(allowedEmailLink('  https://app.ever.team/auth/passcode  ', TEAMS)).toBe(
			'https://app.ever.team/auth/passcode'
		);
	});

	it('never hands a mail client a string it could read another host out of', () => {
		// The URL standard reads this as host app.ever.team, path /@attacker.example. An RFC 3986
		// parser could read "app.ever.team\" as user info and attacker.example as the host, so the raw
		// string must never reach the email: the canonical form has no backslash.
		const link = allowedEmailLink('https://app.ever.team\\@attacker.example', TEAMS);
		expect(link).toBe('https://app.ever.team/@attacker.example');
		expect(new URL(link as string).host).toBe('app.ever.team');
	});

	it('falls back (null) for a foreign origin', () => {
		for (const url of [
			'https://attacker.example/auth/passcode',
			'https://app.ever.team.attacker.example/auth/passcode',
			'https://attacker.example/app.ever.team',
			'https://app.ever.team@attacker.example/auth/passcode',
			'https://attacker.example\\@app.ever.team',
			'https://attacker.example#@app.ever.team',
			'http://app.ever.team/auth/passcode', // same host, other scheme = other origin
			'https://app.ever.team:8443/auth/passcode' // same host, other port = other origin
		]) {
			expect(allowedEmailLink(url, TEAMS)).toBeNull();
		}
	});

	it('falls back (null) for malformed, relative, protocol-relative and non-http(s) links', () => {
		for (const url of [
			'javascript:alert(document.cookie)',
			'JavaScript:alert(1)',
			' javascript:alert(1)',
			'data:text/html,<script>alert(1)</script>',
			'vbscript:msgbox(1)',
			'file:///etc/passwd',
			'ftp://app.ever.team/x',
			'//attacker.example/auth/passcode',
			'\\\\attacker.example/auth/passcode',
			'/auth/passcode',
			'app.ever.team/auth/passcode',
			'https://',
			'https:///auth',
			'not a url',
			'',
			'   ',
			undefined,
			null,
			42,
			{},
			['https://app.ever.team/']
		]) {
			expect(allowedEmailLink(url, TEAMS)).toBeNull();
		}
	});

	it('with "*" accepts any http(s) origin but still nothing else', () => {
		const any = { EMAIL_LINK_ALLOWED_ORIGINS: '*' };
		expect(allowedEmailLink('https://self-hosted.example/sign-in', any)).toBe(
			'https://self-hosted.example/sign-in'
		);
		expect(allowedEmailLink('javascript:alert(1)', any)).toBeNull();
		expect(allowedEmailLink('//attacker.example/x', any)).toBeNull();
	});
});

describe('allowedEmailBaseUrl', () => {
	const TEAMS = { EMAIL_LINK_ALLOWED_ORIGINS: 'https://app.ever.team' };
	const FALLBACK = 'https://app.gauzy.co';

	it('keeps an allowed origin, reduced to scheme://host[:port][/path] without a trailing slash', () => {
		expect(allowedEmailBaseUrl('https://app.ever.team', FALLBACK, TEAMS)).toBe('https://app.ever.team');
		expect(allowedEmailBaseUrl('https://app.ever.team/', FALLBACK, TEAMS)).toBe('https://app.ever.team');
		expect(allowedEmailBaseUrl('https://app.ever.team/sub/dir/?q=1#/x', FALLBACK, TEAMS)).toBe(
			'https://app.ever.team/sub/dir'
		);
	});

	it('strips a long run of trailing slashes in linear time', () => {
		const started = Date.now();
		expect(allowedEmailBaseUrl(`https://app.ever.team/x${'/'.repeat(50_000)}`, FALLBACK, TEAMS)).toBe(
			'https://app.ever.team/x'
		);
		expect(allowedEmailBaseUrl(`https://app.ever.team${'/'.repeat(50_000)}x`, FALLBACK, TEAMS)).toBe(
			`https://app.ever.team${'/'.repeat(50_000)}x`
		);
		expect(Date.now() - started).toBeLessThan(1000);
	});

	it('uses the fallback for a foreign, missing or malformed origin', () => {
		for (const url of [
			'https://attacker.example',
			'https://app.ever.team.attacker.example',
			'null',
			'javascript:alert(1)',
			'//attacker.example',
			'',
			undefined,
			null
		]) {
			expect(allowedEmailBaseUrl(url, FALLBACK, TEAMS)).toBe(FALLBACK);
		}
	});
});

describe('withAllowedEmailLinks', () => {
	const TEAMS = { EMAIL_LINK_ALLOWED_ORIGINS: 'https://app.ever.team' };
	const defaults = environment.appIntegrationConfig;

	it('keeps allowed links and replaces the others with the configured value', () => {
		const onRejected = jest.fn();
		const result = withAllowedEmailLinks(
			{
				appName: 'Ever Teams',
				appLogo: 'https://cdn.example/logo.png',
				appMagicSignUrl: 'https://app.ever.team/auth/passcode',
				appEmailConfirmationUrl: 'https://attacker.example/verify-email',
				appLink: 'javascript:alert(1)',
				companyLink: '//attacker.example'
			},
			onRejected,
			TEAMS
		);

		expect(result).toEqual({
			appName: 'Ever Teams',
			appLogo: 'https://cdn.example/logo.png',
			appMagicSignUrl: 'https://app.ever.team/auth/passcode',
			appEmailConfirmationUrl: defaults.appEmailConfirmationUrl,
			appLink: defaults.appLink,
			companyLink: defaults.companyLink
		});
		expect(onRejected).toHaveBeenCalledTimes(3);
		expect(onRejected).toHaveBeenCalledWith('appEmailConfirmationUrl', 'https://attacker.example');
		expect(onRejected).toHaveBeenCalledWith('appLink', null);
		expect(onRejected).toHaveBeenCalledWith('companyLink', null);
	});

	it('leaves absent fields absent and quietly fills empty ones with the configured value', () => {
		const onRejected = jest.fn();
		expect(withAllowedEmailLinks({ appName: 'Ever Teams' }, onRejected, TEAMS)).toEqual({ appName: 'Ever Teams' });
		expect(withAllowedEmailLinks({ appMagicSignUrl: '', appLink: null }, onRejected, TEAMS)).toEqual({
			appMagicSignUrl: defaults.appMagicSignUrl,
			appLink: defaults.appLink
		});
		expect(onRejected).not.toHaveBeenCalled();
	});

	it('does not modify its input and passes non-objects through', () => {
		const input = { appMagicSignUrl: 'https://attacker.example/x' };
		withAllowedEmailLinks(input, undefined, TEAMS);
		expect(input).toEqual({ appMagicSignUrl: 'https://attacker.example/x' });
		expect(withAllowedEmailLinks(undefined, undefined, TEAMS)).toBeUndefined();
		expect(withAllowedEmailLinks(null, undefined, TEAMS)).toBeNull();
	});

	it('treats an already merged config the same way, leaving the configured values untouched', () => {
		const onRejected = jest.fn();
		const merged = { ...defaults, appMagicSignUrl: 'https://attacker.example/steal' };
		expect(withAllowedEmailLinks(merged, onRejected, TEAMS)).toEqual({ ...defaults });
		expect(onRejected).toHaveBeenCalledTimes(1);
		expect(onRejected).toHaveBeenCalledWith('appMagicSignUrl', 'https://attacker.example');
	});

	it('trusts the configured values even where they are not on the list (company site, unset base URL)', () => {
		const onRejected = jest.fn();
		mockEnvironment.appIntegrationConfig.appMagicSignUrl = 'undefined/#/auth/magic-sign-in';
		const merged = { ...environment.appIntegrationConfig };
		expect(withAllowedEmailLinks(merged, onRejected, {})).toEqual(merged);
		expect(onRejected).not.toHaveBeenCalled();
	});
});
