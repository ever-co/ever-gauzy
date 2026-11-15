// cspell:ignore KHTML okhttp Équipe
import { UserSessionAppEnum } from '@gauzy/contracts';
import { appNameOf, describeSessionClient, originHostOf, sessionSourceOf } from './user-session-client';

describe('describeSessionClient', () => {
	it.each([
		[
			'Chrome on Windows',
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
			{ app: UserSessionAppEnum.WEB, browser: 'Chrome 131', os: 'Windows' }
		],
		[
			'Edge on Windows (which also names Chrome)',
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.51',
			{ app: UserSessionAppEnum.WEB, browser: 'Edge 131', os: 'Windows' }
		],
		[
			'Firefox on Linux',
			'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
			{ app: UserSessionAppEnum.WEB, browser: 'Firefox 132', os: 'Linux' }
		],
		[
			'Safari on macOS',
			'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
			{ app: UserSessionAppEnum.WEB, browser: 'Safari 18', os: 'macOS' }
		],
		[
			'Safari on an iPhone (which also says Mac OS X)',
			'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
			{ app: UserSessionAppEnum.WEB, browser: 'Safari 18', os: 'iOS' }
		],
		[
			'Chrome on Android',
			'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
			{ app: UserSessionAppEnum.WEB, browser: 'Chrome 131', os: 'Android' }
		],
		[
			'the desktop timer',
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) gauzy-desktop-timer/0.1.0 Chrome/130.0.6723.170 Electron/33.2.1 Safari/537.36',
			{ app: UserSessionAppEnum.DESKTOP, browser: null, os: 'Windows' }
		],
		['the Android app', 'okhttp/4.12.0', { app: UserSessionAppEnum.MOBILE, browser: null, os: 'Android' }],
		[
			'the iOS app',
			'EverTeams/1 CFNetwork/1568.200.51 Darwin/24.1.0',
			{ app: UserSessionAppEnum.MOBILE, browser: null, os: 'iOS' }
		],
		['a server-side client', 'node', { app: UserSessionAppEnum.UNKNOWN, browser: null, os: null }],
		['no user agent', 'unknown-user-agent', { app: UserSessionAppEnum.UNKNOWN, browser: null, os: null }]
	])('reads %s', (_name, userAgent, expected) => {
		expect(describeSessionClient(userAgent)).toEqual(expected);
	});

	it('answers UNKNOWN for a session that recorded nothing', () => {
		expect(describeSessionClient(null)).toEqual({ app: UserSessionAppEnum.UNKNOWN, browser: null, os: null });
		expect(describeSessionClient(undefined)).toEqual({ app: UserSessionAppEnum.UNKNOWN, browser: null, os: null });
	});
});

/**
 * Which app a session was opened from (ever-co/ever-gauzy#11983): the same API serves the desktop timer, Ever Gauzy,
 * Ever Teams, Cloc and Works, and two of them on one device look alike by their user agent alone.
 */
describe('the app of a session', () => {
	describe('appNameOf, the name an app gives itself', () => {
		it.each([
			['Ever Teams', 'Ever Teams'],
			['  Ever   Teams  ', 'Ever Teams'],
			['gauzy-desktop-timer', 'gauzy-desktop-timer'],
			["Ever Gauzy's Agent", "Ever Gauzy's Agent"],
			['Équipe 2', 'Équipe 2']
		])('keeps %j as %j', (given, kept) => {
			expect(appNameOf(given)).toBe(kept);
		});

		it.each([
			['nothing', undefined],
			['an empty name', '   '],
			['a header sent twice', ['Ever Teams', 'Ever Gauzy']],
			['markup', '<img src=x onerror=alert(1)>'],
			['a control character', 'Ever\u0007Teams'],
			['more than 64 characters', 'x'.repeat(65)]
		])('refuses %s', (_case, given) => {
			expect(appNameOf(given)).toBeNull();
		});
	});

	describe('originHostOf, the web host a request comes from', () => {
		it.each([
			['https://app.ever.team', 'app.ever.team'],
			['http://localhost:3030', 'localhost:3030']
		])('reads %s as %s', (origin, host) => {
			expect(originHostOf(origin)).toBe(host);
		});

		it.each([['null'], ['file://'], ['app://ever-teams'], ['not an address'], [undefined]])(
			'reads no host in %j',
			(origin) => {
				expect(originHostOf(origin)).toBeNull();
			}
		);
	});

	describe('sessionSourceOf, what a sign-in or a renewal records beside the user agent', () => {
		it('records the name the app gives and the web host it was opened from', () => {
			expect(sessionSourceOf({ 'x-client-app': 'Ever Teams', origin: 'https://app.ever.team' })).toEqual({
				appName: 'Ever Teams',
				appOrigin: 'app.ever.team'
			});
		});

		it('records nothing a request does not tell', () => {
			expect(sessionSourceOf({ 'user-agent': 'node' })).toEqual({});
			expect(sessionSourceOf(undefined)).toEqual({});
		});
	});
});
