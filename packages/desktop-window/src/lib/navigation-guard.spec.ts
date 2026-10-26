/**
 * The desktop windows run with Node in the page and render user content: the timer shows a task's description with
 * `[innerHTML]`, and the server's sanitizer keeps `<a href="https://...">`. No window had a `will-navigate` handler,
 * so one click on such a link loaded the linked page into the window, with Node.
 *
 * Electron cannot run here: `app` and `shell` are mocked, and the web contents are a stand-in that records the
 * handler.
 */
const openExternal = jest.fn(async (_url: string) => undefined);
const appListeners: Record<string, (...args: any[]) => void> = {};

jest.mock(
	'electron',
	() => ({
		app: { on: (name: string, listener: (...args: any[]) => void) => (appListeners[name] = listener) },
		shell: { openExternal: (url: string) => openExternal(url) }
	}),
	{ virtual: true }
);

import { guardNavigation, installNavigationGuard, isOwnFilePage, mayNavigate } from './navigation-guard';

const APP_PAGE = 'file:///opt/Gauzy/resources/app.asar/dist/index.html#/time-tracker';
const API = 'https://api.example.com';

/** A web contents stand-in: its preferences, the page it shows, and the `will-navigate` it registers. */
function contentsWith(preferences: Record<string, unknown> | null, currentUrl = APP_PAGE) {
	let willNavigate: (event: { preventDefault: () => void }, url: string) => void = () => undefined;
	const contents = {
		getLastWebPreferences: () => preferences,
		getURL: () => currentUrl,
		on: (name: string, listener: typeof willNavigate) => {
			if (name === 'will-navigate') willNavigate = listener;
		}
	};
	const navigate = (url: string) => {
		const event = { preventDefault: jest.fn() };
		willNavigate(event, url);
		return event.preventDefault.mock.calls.length > 0 ? 'refused' : 'followed';
	};
	return { contents: contents as any, navigate };
}

const TIMER_PREFERENCES = {
	nodeIntegration: true,
	contextIsolation: false,
	sandbox: false,
	preload: '/app/preload.js'
};

describe('a privileged desktop window follows no link out of its own pages', () => {
	beforeEach(() => openExternal.mockClear());

	it("refuses a task description's link and hands it to the browser", () => {
		const { contents, navigate } = contentsWith(TIMER_PREFERENCES);
		guardNavigation(contents, { trustedUrls: () => [API] });

		expect(navigate('https://evil.example/pwn.html')).toBe('refused');
		expect(openExternal).toHaveBeenCalledWith('https://evil.example/pwn.html');
	});

	it('refuses another file and an SMB share, and opens neither', () => {
		const { contents, navigate } = contentsWith(TIMER_PREFERENCES);
		guardNavigation(contents);

		expect(navigate('file:///etc/passwd.html')).toBe('refused');
		expect(navigate('file://attacker-host/share/index.html')).toBe('refused');
		expect(navigate('javascript:alert(1)')).toBe('refused');
		expect(openExternal).not.toHaveBeenCalled();
	});

	it('guards a window with a preload even when the page itself has no Node (the agent windows)', () => {
		const { contents, navigate } = contentsWith({ contextIsolation: true, preload: '/app/preload.js' });
		guardNavigation(contents);

		expect(navigate('https://evil.example/')).toBe('refused');
	});

	it('CONTROL: follows its own page, the configured API (social sign-in), and the dev server it was loaded from', () => {
		const { contents, navigate } = contentsWith(TIMER_PREFERENCES);
		guardNavigation(contents, { trustedUrls: () => [API, undefined] });

		expect(navigate('file:///opt/Gauzy/resources/app.asar/dist/index.html#/settings')).toBe('followed');
		expect(navigate(`${API}/api/auth/google`)).toBe('followed');

		const dev = contentsWith(TIMER_PREFERENCES, 'http://localhost:4200/#/time-tracker');
		guardNavigation(dev.contents);
		expect(dev.navigate('http://localhost:4200/#/auth/login')).toBe('followed');
		expect(openExternal).not.toHaveBeenCalled();
	});

	it('CONTROL: leaves a window without Node or a preload alone (the sign-in popup on the provider pages)', () => {
		const { contents, navigate } = contentsWith(
			{ nodeIntegration: true, contextIsolation: true },
			'https://accounts.google.com/o/oauth2/auth'
		);
		guardNavigation(contents);

		expect(navigate('https://myaccount.google.com/consent')).toBe('followed');
	});

	it('reads the trusted URLs on every navigation, and trusts none when they cannot be read', () => {
		let configured = API;
		const { contents, navigate } = contentsWith(TIMER_PREFERENCES);
		guardNavigation(contents, { trustedUrls: () => [configured] });

		configured = 'https://other-api.example.com';
		expect(navigate(`${API}/api/auth/google`)).toBe('refused');
		expect(navigate('https://other-api.example.com/api/auth/google')).toBe('followed');

		const broken = contentsWith(TIMER_PREFERENCES);
		guardNavigation(broken.contents, {
			trustedUrls: () => {
				throw new Error('no store');
			}
		});
		expect(broken.navigate(`${API}/api/auth/google`)).toBe('refused');
	});

	it('installs itself on every web contents the app creates', () => {
		installNavigationGuard();
		const { contents, navigate } = contentsWith(TIMER_PREFERENCES);
		appListeners['web-contents-created']({}, contents);

		expect(navigate('https://evil.example/')).toBe('refused');
	});
});

describe('the pages a privileged window may open or reach', () => {
	it('isOwnFilePage: the same bundled page, whatever its hash; a directory URL counts as its index.html', () => {
		expect(
			isOwnFilePage(new URL('file:///app/dist/index.html#/log-history'), 'file:///app/dist/index.html#/')
		).toBe(true);
		expect(isOwnFilePage(new URL('file:///app/dist/index.html#/log-history'), 'file:///app/dist/#/')).toBe(true);
		expect(isOwnFilePage(new URL('file:///tmp/evil.html#/log-history'), 'file:///app/dist/index.html')).toBe(false);
		expect(
			isOwnFilePage(new URL('file://attacker/app/dist/index.html#/log-history'), 'file:///app/dist/index.html')
		).toBe(false);
		expect(isOwnFilePage(new URL('file:///app/dist/index.html'), 'http://localhost:4200/')).toBe(false);
	});

	it('mayNavigate: an http page never reaches a file, and an unparseable URL is refused', () => {
		expect(mayNavigate('http://localhost:4200/', 'file:///app/dist/index.html')).toBe(false);
		expect(mayNavigate(APP_PAGE, 'not a url')).toBe(false);
		expect(mayNavigate(APP_PAGE, 'https://api.example.com.evil.example/', [API])).toBe(false);
	});
});
