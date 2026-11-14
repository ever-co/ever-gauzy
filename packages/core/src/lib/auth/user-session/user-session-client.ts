// cspell:ignore okhttp Dalvik
import { UserSessionAppEnum } from '@gauzy/contracts';

/** What a session's user agent tells about the app it was opened from. */
export interface IUserSessionClient {
	app: UserSessionAppEnum;
	browser: string | null;
	os: string | null;
}

/** The user agent the API records when the request sent none (`RequestContext.currentUserAgent`). */
const UNKNOWN_USER_AGENT = 'unknown-user-agent';

/** Browsers, in the order they must be tried: each one's user agent also names the ones after it. */
const BROWSERS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
	{ name: 'Edge', pattern: /Edg(?:e|A|iOS)?\/(\d+)/ },
	{ name: 'Opera', pattern: /(?:OPR|Opera)\/(\d+)/ },
	{ name: 'Samsung Internet', pattern: /SamsungBrowser\/(\d+)/ },
	{ name: 'Firefox', pattern: /(?:Firefox|FxiOS)\/(\d+)/ },
	{ name: 'Chrome', pattern: /(?:Chrome|CriOS)\/(\d+)/ },
	{ name: 'Safari', pattern: /Version\/(\d+)(?:\.\d+)*.*Safari\// }
];

/** Operating systems, in the order they must be tried (an iPhone's user agent also says "Mac OS X"). */
const SYSTEMS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
	{ name: 'iOS', pattern: /iPhone|iPad|iPod/ },
	{ name: 'Android', pattern: /Android/ },
	{ name: 'Windows', pattern: /Windows/ },
	{ name: 'ChromeOS', pattern: /CrOS/ },
	{ name: 'macOS', pattern: /Mac OS X|Macintosh|Darwin/ },
	{ name: 'Linux', pattern: /Linux/ }
];

/** User agents of the desktop apps (an Electron shell). */
const DESKTOP_APP = /Electron\//;

/** User agents of native mobile apps, which send their HTTP library's rather than a browser's. */
const MOBILE_APP = /okhttp\/|CFNetwork\/|Expo\/|ReactNative|Dalvik\//;

/** The browser and its major version ("Chrome 131"), or null. */
function browserOf(userAgent: string): string | null {
	for (const { name, pattern } of BROWSERS) {
		const match = pattern.exec(userAgent);
		if (match) {
			return `${name} ${match[1]}`;
		}
	}
	return null;
}

/** The operating system, or null. */
function systemOf(userAgent: string): string | null {
	const system = SYSTEMS.find(({ pattern }) => pattern.test(userAgent));
	return system ? system.name : null;
}

/** The operating system of a native mobile app, named by its HTTP library rather than by a browser. */
function mobileSystemOf(userAgent: string): string | null {
	if (/CFNetwork\/|Darwin\/|iPhone|iPad/.test(userAgent)) {
		return 'iOS';
	}
	if (/okhttp\/|Dalvik\/|Android/.test(userAgent)) {
		return 'Android';
	}
	return null;
}

/**
 * Reads the app, browser and system a session was opened from out of its user agent.
 *
 * A user agent is what the client chose to send, so this names the app as far as it tells: the desktop apps send
 * an Electron user agent, the mobile apps their HTTP library's, a browser its own. Anything else is UNKNOWN.
 *
 * @param userAgent The user agent the session's token recorded.
 * @returns The app, browser and system; null for what the user agent does not tell.
 */
export function describeSessionClient(userAgent: string | null | undefined): IUserSessionClient {
	const isKnown = !!userAgent && userAgent !== UNKNOWN_USER_AGENT;
	if (!isKnown) {
		return { app: UserSessionAppEnum.UNKNOWN, browser: null, os: null };
	}

	const os = systemOf(userAgent);
	if (DESKTOP_APP.test(userAgent)) {
		return { app: UserSessionAppEnum.DESKTOP, browser: null, os };
	}
	if (MOBILE_APP.test(userAgent)) {
		return { app: UserSessionAppEnum.MOBILE, browser: null, os: mobileSystemOf(userAgent) };
	}

	const browser = browserOf(userAgent);
	const isBrowser = browser !== null && userAgent.startsWith('Mozilla/');
	if (isBrowser) {
		return { app: UserSessionAppEnum.WEB, browser, os };
	}
	return { app: UserSessionAppEnum.UNKNOWN, browser: null, os };
}
