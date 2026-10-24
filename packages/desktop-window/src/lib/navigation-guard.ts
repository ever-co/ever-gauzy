import { app, shell, WebContents } from 'electron';

/**
 * What a privileged window may still navigate to, besides its own document.
 */
export interface INavigationGuardOptions {
	/**
	 * URLs whose origin a privileged window may navigate to: the API the app is configured for, where the social
	 * sign-in links point (`<API>/api/auth/google`) before the API redirects to the provider. Read on every navigation,
	 * so a server URL changed in the settings applies at once.
	 */
	trustedUrls?: () => Array<string | null | undefined>;
}

/** The links handed to the user's browser when a privileged window may not follow them. */
const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function parseUrl(value: string | null | undefined): URL | null {
	try {
		return value ? new URL(value) : null;
	} catch {
		return null;
	}
}

function isHttp(url: URL): boolean {
	return url.protocol === 'http:' || url.protocol === 'https:';
}

/**
 * Whether a page shown in these contents runs with more than a web page's rights: Node in the page's own world
 * (`nodeIntegration` without context isolation), or a preload, whose globals or `contextBridge` surface the page
 * reaches. Most of the desktop windows are built this way (the timer, the Gauzy window, setup, settings...).
 */
export function isPrivilegedContents(contents: WebContents): boolean {
	const preferences = contents.getLastWebPreferences?.();
	if (!preferences) {
		return true;
	}
	return !!preferences.preload || (!!preferences.nodeIntegration && preferences.contextIsolation === false);
}

/**
 * Whether a `file:` URL is the page a window shows (the app's bundled `index.html`), whatever its hash. A
 * directory URL counts as its `index.html`, as the renderer builds child-window URLs that way.
 *
 * @param target The URL to check.
 * @param currentUrl The page the window shows.
 */
export function isOwnFilePage(target: URL, currentUrl: string | null | undefined): boolean {
	const current = parseUrl(currentUrl);
	if (target.protocol !== 'file:' || current?.protocol !== 'file:' || target.host !== current.host) {
		return false;
	}
	const page = (pathname: string) => (pathname.endsWith('/') ? `${pathname}index.html` : pathname);
	return page(target.pathname) === page(current.pathname);
}

/**
 * Whether a privileged window may follow a navigation it started itself (a link, `location`, a form).
 *
 * Only to its own document (the same `file:` page, for the hash routes, or the same origin when the UI is served
 * over http, as in development), or to a trusted origin. A `file:` URL on another host is an SMB share on Windows.
 *
 * @param currentUrl The page the window shows.
 * @param targetUrl Where the navigation goes.
 * @param trustedUrls URLs whose origin may be navigated to.
 */
export function mayNavigate(
	currentUrl: string | null | undefined,
	targetUrl: string,
	trustedUrls: Array<string | null | undefined> = []
): boolean {
	const target = parseUrl(targetUrl);
	if (!target) {
		return false;
	}

	if (target.protocol === 'file:') {
		return isOwnFilePage(target, currentUrl);
	}
	const current = parseUrl(currentUrl);
	if (!isHttp(target)) {
		return false;
	}
	if (current && isHttp(current) && target.origin === current.origin) {
		return true;
	}
	return trustedUrls.some((trusted) => {
		const url = parseUrl(trusted);
		return !!url && isHttp(url) && url.origin === target.origin;
	});
}

/**
 * Keeps a privileged window on its own pages.
 *
 * The desktop windows run with Node in the page and render user content: a task description is shown with
 * `[innerHTML]`, and the server's sanitizer keeps `<a href="https://...">`. With no `will-navigate` handler, one
 * click on such a link loaded the linked page INTO the window, with Node — `require('child_process')` for whoever
 * wrote the task. A navigation the window may not follow is refused, and an http(s) or mailto link is handed to the
 * user's browser instead.
 *
 * Only renderer-initiated navigations are checked (what `will-navigate` reports): the main process's own `loadURL`,
 * and the redirects of an allowed navigation (the social sign-in), are unchanged.
 *
 * @param contents The web contents to guard; contents that are not privileged are left alone.
 * @param options What a privileged window may still navigate to.
 */
export function guardNavigation(contents: WebContents, options: INavigationGuardOptions = {}): void {
	contents.on('will-navigate', (event, url) => {
		if (!isPrivilegedContents(contents)) {
			return;
		}
		let trustedUrls: Array<string | null | undefined> = [];
		try {
			trustedUrls = options.trustedUrls?.() ?? [];
		} catch {
			// No trusted URL rather than a navigation let through
		}
		if (mayNavigate(contents.getURL(), url, trustedUrls)) {
			return;
		}

		event.preventDefault();
		const target = parseUrl(url);
		if (target && EXTERNAL_PROTOCOLS.has(target.protocol)) {
			shell.openExternal(target.toString()).catch((error) => {
				console.error('Error opening external URL:', error);
			});
		}
	});
}

/**
 * Guards every web contents the app creates from now on. Call it once, from the main process, before the first
 * window is created.
 *
 * @param options What a privileged window may still navigate to.
 */
export function installNavigationGuard(options: INavigationGuardOptions = {}): void {
	app.on('web-contents-created', (_event, contents) => guardNavigation(contents, options));
}
