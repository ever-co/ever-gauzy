// cspell:ignore okhttp Dalvik KHTML
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

/** The header in which a first-party app names itself on its requests ("Ever Teams"), ever-co/ever-gauzy#11983. */
export const CLIENT_APP_HEADER = 'x-client-app';

/** A plain app name: letters, digits, spaces and `. _ ' -`, 64 characters at most, starting with a letter or digit. */
const APP_NAME = /^[\p{L}\p{N}][\p{L}\p{N} ._'-]{0,63}$/u;

/** The name an Electron app's default user agent carries before `Chrome/` ("gauzy-desktop-timer/0.1.0 Chrome/…"). */
const ELECTRON_APP_NAME = /\(KHTML, like Gecko\) (.+?)\/[\w.-]+ Chrome\//;

/** The name an iOS app's user agent starts with ("EverTeams/1 CFNetwork/1568.200.51 Darwin/24.1.0"). */
const IOS_APP_NAME = /^([^/]+)\/[\w.-]+ CFNetwork\//;

/**
 * A web host as a session records and shows it ("app.example.com", "localhost:3030", "[::1]:3030"): a DNS name of 253
 * characters at most or a bracketed IPv6 address, with its port when it has one. The `Origin` header is what the
 * client says, so a longer or stranger host is never written into a token, nor read back from one.
 */
export const WEB_HOST = /^(?:[\w.-]{1,253}|\[[\dA-Fa-f:.]{2,45}\])(?::\d{1,5})?$/;

/** What a sign-in or a renewal records about the app it came from, beside its user agent. */
export interface IUserSessionSource {
	appName?: string;
	appOrigin?: string;
}

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

/**
 * An app name as a client gave it, its spaces collapsed; null for anything that is not a plain name (a header sent
 * twice, markup, control characters, more than 64 characters). It is what the client says, as a user agent is: good
 * for naming a session to its user, never for a decision.
 *
 * @param value The name as the request or the token holds it.
 * @returns The name, or null.
 */
export function appNameOf(value: unknown): string | null {
	if (typeof value !== 'string') {
		return null;
	}
	const name = value.trim().replace(/\s+/g, ' ');
	return APP_NAME.test(name) ? name : null;
}

/**
 * The name of the app a user agent carries: an Electron app's default agent names it before `Chrome/`, an iOS app's
 * starts with it. A browser's names none, and neither does an Android app's, which names its HTTP library only.
 *
 * @param userAgent The user agent the session's token recorded.
 * @returns The name, or null.
 */
export function appNameInUserAgent(userAgent: string | null | undefined): string | null {
	if (!userAgent) {
		return null;
	}
	const electronName = DESKTOP_APP.test(userAgent) ? ELECTRON_APP_NAME.exec(userAgent)?.[1] : undefined;
	const name = appNameOf(electronName ?? IOS_APP_NAME.exec(userAgent)?.[1]);
	// An Electron app that never set its name sends Electron's own
	return name === 'Electron' ? null : name;
}

/**
 * The web host a request comes from ("app.example.com"), from its `Origin` header: a browser sends it on a cross-origin
 * call and on a POST. Null for anything but an http or https origin (an app's own scheme, `null`), and for a host that
 * is not a plain {@link WEB_HOST} (one past 253 characters).
 *
 * @param origin The `Origin` header.
 * @returns The host, with its port when it has one, or null.
 */
export function originHostOf(origin: unknown): string | null {
	if (typeof origin !== 'string' || !origin) {
		return null;
	}
	try {
		const url = new URL(origin);
		const isWeb = url.protocol === 'https:' || url.protocol === 'http:';
		return isWeb && WEB_HOST.test(url.host) ? url.host : null;
	} catch {
		return null;
	}
}

/**
 * What a sign-in or a renewal records about the app it came from, beside its user agent: the name the app gives in
 * `X-Client-App`, and the web host of a browser's request. Only what the request tells.
 *
 * @param headers The request's headers.
 * @returns The app's name and web host, each when the request tells it.
 */
export function sessionSourceOf(headers: Record<string, unknown> | null | undefined): IUserSessionSource {
	const appName = appNameOf(headers?.[CLIENT_APP_HEADER]);
	const appOrigin = originHostOf(headers?.['origin']);
	return { ...(appName && { appName }), ...(appOrigin && { appOrigin }) };
}
