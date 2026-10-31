/**
 * The screenshot notification used to be placed once, when its window was created, from the primary
 * display's width alone: after the displays were re-arranged while the timer ran it stayed on
 * whatever monitor that old position fell into (#7538), and a primary display not at (0, 0) put it on
 * a neighbouring monitor from the start.
 *
 * Electron cannot run here: `screen` and the desktop-core window plumbing are mocked.
 */
let primaryDisplay = { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
let otherDisplays: { id: number; workArea: { x: number; y: number; width: number; height: number } }[] = [];
/** The application settings: which display the notification goes to */
let appSetting: { screenshotNotificationDisplayId?: number | null } = {};

/** The `ipcMain.on` listeners by channel */
const ipcListeners = new Map<string, Set<(event: { sender: unknown }) => void>>();

jest.mock(
	'electron',
	() => ({
		screen: { getPrimaryDisplay: () => primaryDisplay, getAllDisplays: () => [primaryDisplay, ...otherDisplays] },
		ipcMain: {
			on: (channel: string, listener: (event: { sender: unknown }) => void) => {
				if (!ipcListeners.has(channel)) ipcListeners.set(channel, new Set());
				ipcListeners.get(channel).add(listener);
			},
			removeListener: (channel: string, listener: (event: { sender: unknown }) => void) => {
				ipcListeners.get(channel)?.delete(listener);
			}
		}
	}),
	{ virtual: true }
);

/** The window's own listeners by event (`closed`) */
const windowListeners = new Map<string, () => void>();
const browserWindow = {
	setPosition: jest.fn(),
	showInactive: jest.fn(),
	setVisibleOnAllWorkspaces: jest.fn(),
	setAlwaysOnTop: jest.fn(),
	setFullScreenable: jest.fn(),
	on: jest.fn((event: string, listener: () => void) => windowListeners.set(event, listener)),
	webContents: { send: jest.fn() }
};
const windowOptions: any[] = [];
/** `BaseWindow.hide()`: what actually hides the window */
const baseHide = jest.fn();

jest.mock('@gauzy/desktop-core', () => ({
	BaseWindow: class {
		get browserWindow() {
			return browserWindow;
		}
		hide() {
			baseHide();
		}
	},
	DefaultWindow: class {},
	WindowConfig: class {
		constructor(_path: string, _file: string, options: any) {
			windowOptions.push(options);
		}
	},
	WindowManager: { getInstance: () => ({ overrideSystemContextMenu: jest.fn(), register: jest.fn() }) },
	RegisteredWindow: { CAPTURE: 'capture' },
	localStore: { applicationSettingService: { find: () => appSetting } },
	store: { get: () => ({ note: 'note' }) }
}));

import { ScreenCaptureNotification } from './screen-capture-notification';

describe('ScreenCaptureNotification placement', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		windowOptions.length = 0;
		primaryDisplay = { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } };
		otherDisplays = [];
		appSetting = {};
	});

	it('is created in the top-right corner of the primary display work area, origin included', () => {
		primaryDisplay = { id: 1, workArea: { x: 2560, y: 100, width: 1920, height: 1040 } };

		new ScreenCaptureNotification();

		expect(windowOptions[0]).toEqual(expect.objectContaining({ x: 2560 + 1920 - (310 + 16), y: 116 }));
	});

	it('moves back onto the current primary display before every show()', () => {
		const notification = new ScreenCaptureNotification();

		notification.show('thumb');
		expect(browserWindow.setPosition).toHaveBeenLastCalledWith(1920 - (310 + 16), 16);

		// The displays are re-arranged while the app runs: a new, offset primary display.
		primaryDisplay = { id: 1, workArea: { x: -1920, y: 0, width: 1920, height: 1080 } };
		notification.show('thumb');

		expect(browserWindow.setPosition).toHaveBeenLastCalledWith(-1920 + 1920 - (310 + 16), 16);
		expect(browserWindow.setPosition.mock.invocationCallOrder[1]).toBeLessThan(
			browserWindow.showInactive.mock.invocationCallOrder[1]
		);
		expect(browserWindow.webContents.send).toHaveBeenCalledWith('show_popup_screen_capture', {
			note: 'note',
			imgUrl: 'thumb'
		});
	});

	describe('the display chosen in the settings', () => {
		const secondary = { id: 2, workArea: { x: 1920, y: 0, width: 2560, height: 1400 } };

		it('is used instead of the primary display', () => {
			otherDisplays = [secondary];
			appSetting = { screenshotNotificationDisplayId: 2 };

			const notification = new ScreenCaptureNotification();
			notification.show();

			expect(windowOptions[0]).toEqual(expect.objectContaining({ x: 1920 + 2560 - (310 + 16), y: 16 }));
			expect(browserWindow.setPosition).toHaveBeenLastCalledWith(1920 + 2560 - (310 + 16), 16);
		});

		it('falls back to the primary display once the chosen display is disconnected', () => {
			otherDisplays = [secondary];
			appSetting = { screenshotNotificationDisplayId: 2 };
			const notification = new ScreenCaptureNotification();

			otherDisplays = [];
			notification.show();

			expect(browserWindow.setPosition).toHaveBeenLastCalledWith(1920 - (310 + 16), 16);
		});

		it('takes effect on the next show() when it changes, without a new window', () => {
			otherDisplays = [secondary];
			const notification = new ScreenCaptureNotification();

			appSetting = { screenshotNotificationDisplayId: 2 };
			notification.show();
			expect(browserWindow.setPosition).toHaveBeenLastCalledWith(1920 + 2560 - (310 + 16), 16);

			// Back to the default
			appSetting = { screenshotNotificationDisplayId: null };
			notification.show();
			expect(browserWindow.setPosition).toHaveBeenLastCalledWith(1920 - (310 + 16), 16);
		});

		it('is the primary display when nothing was chosen', () => {
			otherDisplays = [secondary];
			appSetting = { screenshotNotificationDisplayId: null };

			new ScreenCaptureNotification().show();

			expect(browserWindow.setPosition).toHaveBeenLastCalledWith(1920 - (310 + 16), 16);
		});
	});
});

/**
 * The notification could only be waited out: a close (X) button now hides it at once (#7643).
 */
describe('ScreenCaptureNotification hiding', () => {
	const closeListeners = () => [...(ipcListeners.get(ScreenCaptureNotification.CLOSE_CHANNEL) ?? [])];
	/** What the close button of the notification page sends, from the given page */
	const requestClose = (sender: unknown = browserWindow.webContents) =>
		closeListeners().forEach((listener) => listener({ sender }));

	beforeEach(() => {
		jest.useFakeTimers();
		jest.clearAllMocks();
		ipcListeners.clear();
		windowListeners.clear();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('still hides on its own 3 seconds after hide()', () => {
		const notification = new ScreenCaptureNotification();

		notification.hide();
		jest.advanceTimersByTime(ScreenCaptureNotification.AUTO_HIDE_DELAY_MS - 1);
		expect(baseHide).not.toHaveBeenCalled();

		jest.advanceTimersByTime(1);
		expect(baseHide).toHaveBeenCalledTimes(1);
	});

	it('hides at once on hideNow(), and the pending delayed hide does not run afterwards', () => {
		const notification = new ScreenCaptureNotification();
		notification.hide();

		notification.hideNow();
		expect(baseHide).toHaveBeenCalledTimes(1);

		jest.advanceTimersByTime(ScreenCaptureNotification.AUTO_HIDE_DELAY_MS);
		expect(baseHide).toHaveBeenCalledTimes(1);
	});

	it('restarts the delay when hide() is called again, so a notification shown meanwhile stays its full time', () => {
		const notification = new ScreenCaptureNotification();
		notification.hide();
		jest.advanceTimersByTime(2000);

		notification.show('next');
		notification.hide();
		jest.advanceTimersByTime(2000);
		expect(baseHide).not.toHaveBeenCalled();

		jest.advanceTimersByTime(1000);
		expect(baseHide).toHaveBeenCalledTimes(1);
	});

	it('hides at once when its close button is clicked', () => {
		const notification = new ScreenCaptureNotification();
		notification.show('thumb');
		notification.hide();

		requestClose();

		expect(baseHide).toHaveBeenCalledTimes(1);
		jest.advanceTimersByTime(ScreenCaptureNotification.AUTO_HIDE_DELAY_MS);
		expect(baseHide).toHaveBeenCalledTimes(1);
	});

	it('ignores a close request sent from another window', () => {
		new ScreenCaptureNotification();

		requestClose({ send: jest.fn() });

		expect(baseHide).not.toHaveBeenCalled();
	});

	it('stops listening once its window is destroyed', () => {
		new ScreenCaptureNotification();
		expect(closeListeners()).toHaveLength(1);

		windowListeners.get('closed')();

		expect(closeListeners()).toHaveLength(0);
	});

	it('lets a click reach the close button on macOS, where the window is never active', () => {
		windowOptions.length = 0;

		new ScreenCaptureNotification();

		expect(windowOptions[0]).toEqual(expect.objectContaining({ focusable: false, acceptFirstMouse: true }));
	});
});
