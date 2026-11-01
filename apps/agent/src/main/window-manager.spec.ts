/**
 * The Agent shows its screenshot notification once the window is ready. A notification closed meanwhile (its close
 * button, #7643, or its auto-hide) must end that wait instead of polling a destroyed window forever.
 */
jest.mock('@gauzy/desktop-window', () => ({
	createAboutWindow: jest.fn(),
	SplashScreen: class {},
	createSetupWindow: jest.fn(),
	AuthWindow: class {},
	createSettingsWindow: jest.fn(),
	createServerWindow: jest.fn(),
	AlwaysOn: class {}
}));
jest.mock(
	'electron',
	() => ({
		app: { getPath: jest.fn(), dock: { hide: jest.fn() } },
		BrowserWindow: { getAllWindows: () => [] },
		screen: { getPrimaryDisplay: jest.fn() }
	}),
	{ virtual: true }
);
jest.mock('./util', () => ({
	resolveHtmlPath: jest.fn(),
	getInitialConfig: jest.fn(),
	// A real (short) wait, so the polling yields to timers like the one in Electron
	delaySync: () => new Promise((resolve) => setTimeout(resolve, 1))
}));
jest.mock('@gauzy/desktop-lib', () => ({ LocalStore: { getStore: jest.fn() } }));
jest.mock('./window/screen-capture-window', () => ({ ScreenCaptureWindow: class {} }));
jest.mock('./events/events', () => ({ __esModule: true, default: { emit: jest.fn() } }));
jest.mock('../constant', () => ({ MAIN_EVENT: 'main-event', MAIN_EVENT_TYPE: {} }));

import AppWindow, { WindowType } from './window-manager';

/** A BrowserWindow stand-in. */
function fakeWindow({ destroyed = false, loading = false } = {}) {
	return {
		isDestroyed: () => destroyed,
		webContents: { isLoading: () => loading },
		destroy: jest.fn(() => (destroyed = true)),
		finishLoading: () => (loading = false)
	};
}

describe('AppWindow.isWindowReadyToShow', () => {
	let appWindow: AppWindow;

	beforeEach(() => {
		appWindow = AppWindow.getInstance('/app');
		appWindow.notificationWindow = null;
		(appWindow as any).windowReadyStatus.notificationWindow = false;
	});

	it('waits for the notification window to be ready', async () => {
		const window = fakeWindow({ loading: true });
		appWindow.notificationWindow = { browserWindow: window } as any;
		setTimeout(() => {
			window.finishLoading();
			(appWindow as any).windowReadyStatus.notificationWindow = true;
		}, 0);

		await expect(appWindow.isWindowReadyToShow(window as any, WindowType.notificationWindow)).resolves.toBe(true);
	});

	it('stops waiting when the notification is closed meanwhile', async () => {
		const window = fakeWindow({ loading: true });
		appWindow.notificationWindow = { browserWindow: window } as any;

		const ready = appWindow.isWindowReadyToShow(window as any, WindowType.notificationWindow);
		appWindow.hideNotificationWindow();

		await expect(ready).resolves.toBe(false);
		expect(window.destroy).toHaveBeenCalled();
	});

	it('stops waiting for a notification window that was replaced by a new one', async () => {
		const stale = fakeWindow();
		appWindow.notificationWindow = { browserWindow: fakeWindow() } as any;

		await expect(appWindow.isWindowReadyToShow(stale as any, WindowType.notificationWindow)).resolves.toBe(false);
	});

	it('shows nothing for a missing or destroyed window', async () => {
		await expect(appWindow.isWindowReadyToShow(undefined, WindowType.dashboardWindow)).resolves.toBe(false);
		await expect(
			appWindow.isWindowReadyToShow(fakeWindow({ destroyed: true }) as any, WindowType.dashboardWindow)
		).resolves.toBe(false);
	});

	it('shows a loaded dashboard window', async () => {
		await expect(appWindow.isWindowReadyToShow(fakeWindow() as any, WindowType.dashboardWindow)).resolves.toBe(
			true
		);
	});
});
