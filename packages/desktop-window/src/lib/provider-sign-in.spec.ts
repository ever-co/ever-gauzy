/**
 * The provider (social) sign-in of the desktop apps: the provider's pages open in a popup, and the API's redirect back
 * tells the sign-in window how it ended. The agent never heard the end (no `social_auth_success`), so its provider
 * sign-in never finished; the timer and the agent now share this one handler.
 *
 * Electron cannot run here: `app`, `shell` and `BrowserWindow` are mocked, and the web contents are a stand-in that
 * records the `will-redirect` handler.
 */
const mockOpenExternal = jest.fn(async (_url: string) => undefined);
const mockAppListeners: Record<string, (...args: any[]) => void> = {};
const mockPopups: any[] = [];

jest.mock(
	'electron',
	() => ({
		app: { on: (name: string, listener: (...args: any[]) => void) => (mockAppListeners[name] = listener) },
		shell: { openExternal: (url: string) => mockOpenExternal(url) },
		BrowserWindow: class {
			destroyed = false;
			loadURL = jest.fn(async () => undefined);
			show = jest.fn();
			destroy = jest.fn(() => (this.destroyed = true));
			isDestroyed = () => this.destroyed;
			constructor(public options: unknown) {
				mockPopups.push(this);
			}
		}
	}),
	{ virtual: true }
);

import { installProviderSignIn, parseProviderSignInRedirect } from './provider-sign-in';

const WEB = 'https://app.example.com';
const JWT = 'jwt-header.jwt-payload.jwt-signature';

describe('parseProviderSignInRedirect', () => {
	it("reads the provider's sign-in pages", () => {
		expect(parseProviderSignInRedirect('https://accounts.google.com/o/oauth2/v2/auth?client_id=x')).toEqual({
			type: 'provider'
		});
		expect(parseProviderSignInRedirect('https://www.linkedin.com/oauth/v2/authorization?x=1')).toEqual({
			type: 'provider'
		});
	});

	it('does not take a page that merely names a provider for the provider', () => {
		expect(parseProviderSignInRedirect('https://evil.example/?next=https://accounts.google.com')).toBeNull();
		expect(parseProviderSignInRedirect('https://www.linkedin.com/feed')).toBeNull();
	});

	it('reads the token of a sign-in that matched one account', () => {
		expect(parseProviderSignInRedirect(`${WEB}/#/sign-in/success?jwt=${JWT}&userId=user-1`)).toEqual({
			type: 'signed-in',
			token: JWT,
			userId: 'user-1'
		});
	});

	it("reads the workspace picker's e-mail and one-time code, decoded", () => {
		expect(
			parseProviderSignInRedirect(`${WEB}/#/auth/magic-sign-in?email=a%2Bb%40example.com&code=123456`)
		).toEqual({
			type: 'workspaces',
			email: 'a+b@example.com',
			code: '123456'
		});
	});

	it('reads the registration page of a sign-in that matched no account', () => {
		expect(parseProviderSignInRedirect(`${WEB}/#/auth/register`)).toEqual({ type: 'register' });
	});

	it('ignores anything else, a non-http URL and an unparseable one', () => {
		expect(parseProviderSignInRedirect(`${WEB}/#/time-tracker`)).toBeNull();
		expect(parseProviderSignInRedirect(`${WEB}/#/sign-in/success`)).toBeNull();
		expect(parseProviderSignInRedirect(`file:///app/index.html#/sign-in/success?jwt=${JWT}`)).toBeNull();
		expect(parseProviderSignInRedirect('not a url')).toBeNull();
	});
});

describe('installProviderSignIn', () => {
	let signInWindow: { isDestroyed: () => boolean; webContents: { send: jest.Mock } } | null;

	/** A web contents stand-in that records the `will-redirect` handler the sign-in registers on it */
	function contents() {
		let willRedirect: (event: { preventDefault: () => void }, url: string) => Promise<void> = async () => undefined;
		mockAppListeners['web-contents-created'](
			{},
			{
				on: (name: string, listener: typeof willRedirect) => {
					if (name === 'will-redirect') willRedirect = listener;
				}
			}
		);
		return async (url: string) => {
			const event = { preventDefault: jest.fn() };
			await willRedirect(event, url);
			return event.preventDefault.mock.calls.length > 0 ? 'cancelled' : 'followed';
		};
	}

	beforeEach(() => {
		mockOpenExternal.mockClear();
		mockPopups.length = 0;
		signInWindow = { isDestroyed: () => false, webContents: { send: jest.fn() } };
		installProviderSignIn({ signInWindow: () => signInWindow as any, signInDetails: () => ({ host: 'local' }) });
	});

	it("opens the provider's page in a popup, without Node in the page", async () => {
		const redirect = contents();

		expect(await redirect('https://accounts.google.com/o/oauth2/v2/auth?client_id=x')).toBe('cancelled');
		expect(mockPopups).toHaveLength(1);
		expect(mockPopups[0].options.webPreferences).toMatchObject({ contextIsolation: true });
		expect(mockPopups[0].options.webPreferences.preload).toBeUndefined();
		expect(mockPopups[0].loadURL).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?client_id=x', {
			userAgent: 'Chrome/104.0.0.0'
		});
		expect(mockPopups[0].show).toHaveBeenCalled();
	});

	it('closes the popup and tells the sign-in window the token (social_auth_success)', async () => {
		await contents()('https://accounts.google.com/o/oauth2/v2/auth');
		const popupRedirect = contents();

		await popupRedirect(`${WEB}/#/sign-in/success?jwt=${JWT}&userId=user-1`);

		expect(mockPopups[0].destroy).toHaveBeenCalled();
		expect(signInWindow!.webContents.send).toHaveBeenCalledWith('social_auth_success', {
			host: 'local',
			token: JWT,
			userId: 'user-1'
		});
	});

	it("cancels the web app's workspace picker and hands the code to the sign-in window (social_auth_workspaces)", async () => {
		await contents()('https://www.linkedin.com/oauth/v2/authorization');
		const popupRedirect = contents();

		expect(await popupRedirect(`${WEB}/#/auth/magic-sign-in?email=a%40example.com&code=123456`)).toBe('cancelled');

		expect(mockPopups[0].destroy).toHaveBeenCalled();
		expect(signInWindow!.webContents.send).toHaveBeenCalledWith('social_auth_workspaces', {
			email: 'a@example.com',
			code: '123456'
		});
	});

	it('still cancels a workspace picker redirect without a code, and sends nothing', async () => {
		expect(await contents()(`${WEB}/#/auth/magic-sign-in?email=a%40example.com`)).toBe('cancelled');
		expect(signInWindow!.webContents.send).not.toHaveBeenCalled();
	});

	it('opens the registration page in the browser when no account matched', async () => {
		expect(await contents()(`${WEB}/#/auth/register`)).toBe('followed');
		expect(mockOpenExternal).toHaveBeenCalledWith(`${WEB}/#/auth/register`);
	});

	it('sends nothing when the sign-in window is gone', async () => {
		signInWindow = null;
		await expect(contents()(`${WEB}/#/sign-in/success?jwt=${JWT}&userId=user-1`)).resolves.toBe('followed');
	});

	it('CONTROL: leaves every other redirect alone', async () => {
		expect(await contents()('https://api.example.com/api/auth/google/callback?code=x')).toBe('followed');
		expect(mockPopups).toHaveLength(0);
		expect(signInWindow!.webContents.send).not.toHaveBeenCalled();
		expect(mockOpenExternal).not.toHaveBeenCalled();
	});
});
