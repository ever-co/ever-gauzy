import { app, BrowserWindow, shell } from 'electron';

/**
 * Where a redirect seen during a provider (social) sign-in leads.
 *
 * - `provider`: the provider's own sign-in page (Google, LinkedIn) over https, shown in a popup.
 * - `insecure-provider`: a provider's sign-in page over plain http: refused, as its traffic (the password typed there,
 *   the result it redirects to) could be read and changed on the way.
 * - `signed-in`: the API signed the one matching account in (`#/sign-in/success?jwt=…&userId=…`).
 * - `workspaces`: the address has several workspaces, so the API sends the workspace picker a one-time sign-in code
 *   instead of a token (`#/auth/magic-sign-in?email=…&code=…`).
 * - `register`: no account matched (`#/auth/register`).
 */
export type ProviderSignInRedirect =
	| { type: 'provider' }
	| { type: 'insecure-provider' }
	| { type: 'signed-in'; token: string; userId: string | null }
	| { type: 'workspaces'; email: string | null; code: string | null }
	| { type: 'register' };

/** How a desktop app learns where its provider sign-in ended. */
export interface IProviderSignInOptions {
	/** The window showing the sign-in page: told how the sign-in ended (`social_auth_success`, `social_auth_workspaces`) */
	signInWindow: () => BrowserWindow | null | undefined;
	/** Sent along with the token on `social_auth_success` (the timer adds its request parameters) */
	signInDetails?: () => Record<string, unknown> | null;
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/** The provider pages shown in the popup: no preload, so the page gets no Node (`contextIsolation`) */
const POPUP_OPTIONS = {
	title: '',
	width: 1280,
	height: 600,
	webPreferences: {
		allowRunningInsecureContent: false,
		contextIsolation: true,
		enableRemoteModule: true,
		javascript: true,
		webSecurity: false,
		webviewTag: false,
		nodeIntegration: true
	}
};

/** The user agent the provider pages are loaded with */
const POPUP_USER_AGENT = 'Chrome/104.0.0.0';

/** The route and the query of a hash-routed page (`https://app/#/sign-in/success?jwt=…`) */
function hashRoute(target: URL): { path: string; params: URLSearchParams } {
	const hash = target.hash.replace(/^#/, '');
	const query = hash.indexOf('?');
	return query < 0
		? { path: hash, params: new URLSearchParams() }
		: { path: hash.slice(0, query), params: new URLSearchParams(hash.slice(query + 1)) };
}

/**
 * Reads a redirect seen during a provider sign-in.
 *
 * @param url Where the redirect goes.
 * @returns What the redirect means, or `null` when it is none of the sign-in's steps (or not http/https).
 */
export function parseProviderSignInRedirect(url: string): ProviderSignInRedirect | null {
	let target: URL;
	try {
		target = new URL(url);
	} catch {
		return null;
	}
	if (!ALLOWED_PROTOCOLS.has(target.protocol)) {
		return null;
	}

	if (
		target.hostname === 'accounts.google.com' ||
		(target.hostname === 'www.linkedin.com' && target.pathname.startsWith('/oauth'))
	) {
		return { type: target.protocol === 'https:' ? 'provider' : 'insecure-provider' };
	}

	const { path, params } = hashRoute(target);
	if (path === '/auth/magic-sign-in' && (params.has('email') || params.has('code'))) {
		return { type: 'workspaces', email: params.get('email'), code: params.get('code') };
	}
	const token = params.get('jwt');
	if (path === '/sign-in/success' && token) {
		return { type: 'signed-in', token, userId: params.get('userId') };
	}
	if (path === '/auth/register' || target.pathname.endsWith('/auth/register')) {
		return { type: 'register' };
	}
	return null;
}

/**
 * Runs the provider (social) sign-in of a desktop app: the provider's pages open in a popup, and when the API
 * redirects back the popup closes and the sign-in window is told how it ended:
 *
 * - `social_auth_success` with the token (and `signInDetails`), when one account matched;
 * - `social_auth_workspaces` with the e-mail and the one-time code, when the address has several workspaces. The
 *   redirect is cancelled: the web app's picker must not load, as it would claim the code (it works once) and sign in
 *   there, never in the desktop app. The app shows its own picker (`/auth/magic-sign-in`), which confirms the code,
 *   lists the workspaces and signs in to the one chosen;
 * - the web app's registration page opens in the browser when no account matched.
 *
 * Only the popup this sign-in opened ends it: its pages are the provider's, which redirect to the API, which redirects
 * to the result. A result any other page redirects to (a page of someone else's, carrying their own token) is left
 * alone, so it can neither sign the app in to another account nor hand it a workspace code.
 *
 * Call it once, from the main process, before the first window is created.
 *
 * @param options The window to tell, and what to send along with the token.
 */
export function installProviderSignIn(options: IProviderSignInOptions): void {
	let popup: BrowserWindow | null = null;
	// Kept apart from `popup`: a destroyed window's contents can no longer be read
	let popupContentsId: number | null = null;

	const closePopup = () => {
		if (popup && !popup.isDestroyed()) {
			popup.destroy();
		}
		popup = null;
		popupContentsId = null;
	};

	const showPopup = async (url: string) => {
		closePopup();
		// A local reference: a redirect while the page loads may close this popup, or open another one
		const opened = new BrowserWindow({ ...POPUP_OPTIONS, webPreferences: { ...POPUP_OPTIONS.webPreferences } });
		popup = opened;
		popupContentsId = opened.webContents.id;
		try {
			await opened.loadURL(url, { userAgent: POPUP_USER_AGENT });
		} catch (error) {
			// No hidden window left behind
			if (popup === opened) {
				closePopup();
			} else if (!opened.isDestroyed()) {
				opened.destroy();
			}
			throw error;
		}
		if (!opened.isDestroyed()) {
			opened.show();
		}
	};

	const tell = (channel: string, payload: Record<string, unknown>) => {
		const signInWindow = options.signInWindow();
		if (signInWindow && !signInWindow.isDestroyed()) {
			signInWindow.webContents.send(channel, payload);
		}
	};

	app.on('web-contents-created', (_event, contents) => {
		contents.on('will-redirect', async (event, legacyUrl) => {
			// The details' `url` first: the positional one is deprecated
			const url = (event as { url?: string }).url || legacyUrl;
			const redirect = parseProviderSignInRedirect(url);
			if (!redirect) {
				return;
			}
			// A sign-in result counts only in the popup this sign-in opened
			const isResult =
				redirect.type === 'signed-in' || redirect.type === 'workspaces' || redirect.type === 'register';
			if (isResult && (popupContentsId === null || contents.id !== popupContentsId)) {
				return;
			}
			switch (redirect.type) {
				case 'insecure-provider':
					event.preventDefault();
					return;
				case 'provider':
					event.preventDefault();
					try {
						await showPopup(url);
					} catch {
						// Soft fail
					}
					return;
				case 'workspaces':
					event.preventDefault();
					closePopup();
					if (redirect.email && redirect.code) {
						tell('social_auth_workspaces', { email: redirect.email, code: redirect.code });
					}
					return;
				case 'signed-in':
					closePopup();
					tell('social_auth_success', {
						...(options.signInDetails?.() ?? {}),
						token: redirect.token,
						userId: redirect.userId
					});
					return;
				case 'register':
					try {
						await shell.openExternal(url);
					} catch (error) {
						console.error('Error opening external URL:', error);
					}
					return;
			}
		});
	});
}
