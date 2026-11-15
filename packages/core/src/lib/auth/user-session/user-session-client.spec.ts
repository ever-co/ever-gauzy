// cspell:ignore KHTML okhttp
import { UserSessionAppEnum } from '@gauzy/contracts';
import { describeSessionClient } from './user-session-client';

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
