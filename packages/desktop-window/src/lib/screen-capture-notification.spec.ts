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

jest.mock(
	'electron',
	() => ({
		screen: { getPrimaryDisplay: () => primaryDisplay, getAllDisplays: () => [primaryDisplay, ...otherDisplays] }
	}),
	{ virtual: true }
);

const browserWindow = {
	setPosition: jest.fn(),
	showInactive: jest.fn(),
	setVisibleOnAllWorkspaces: jest.fn(),
	setAlwaysOnTop: jest.fn(),
	setFullScreenable: jest.fn(),
	webContents: { send: jest.fn() }
};
const windowOptions: any[] = [];

jest.mock('@gauzy/desktop-core', () => ({
	BaseWindow: class {
		get browserWindow() {
			return browserWindow;
		}
		hide() {}
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
