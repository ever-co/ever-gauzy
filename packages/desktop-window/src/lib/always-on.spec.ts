/**
 * The mini timer always opened at the left edge of the primary display: it now opens where the user left it (#7683)
 * when that spot is on a connected display. Electron and the desktop-core window plumbing are mocked.
 */
let displays = [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }];
jest.mock(
	'electron',
	() => ({
		screen: {
			getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1040 } }),
			getAllDisplays: () => displays
		}
	}),
	{ virtual: true }
);

const storeData: Record<string, any> = {};
const windowOptions: any[] = [];
let windowListeners: Map<string, (...args: unknown[]) => void>;
let position: [number, number];
const browserWindow = {
	setMenuBarVisibility: jest.fn(),
	on: jest.fn((event: string, listener: () => void) => windowListeners.set(event, listener)),
	getPosition: () => position,
	isDestroyed: () => false,
	destroy: jest.fn()
};

jest.mock('@gauzy/desktop-core', () => ({
	BaseWindow: class {
		get browserWindow() {
			return browserWindow;
		}
	},
	DefaultWindow: class {},
	WindowConfig: class {
		constructor(_path: string, _file: string, options: any) {
			windowOptions.push(options);
		}
	},
	WindowManager: {
		getInstance: () => ({ overrideSystemContextMenu: jest.fn(), register: jest.fn(), unregister: jest.fn() })
	},
	RegisteredWindow: { WIDGET: 'widget' },
	store: {
		get: (key: string) => storeData[key],
		set: (key: string, value: unknown) => {
			storeData[key] = value;
		}
	}
}));

import { AlwaysOn } from './always-on';
import { WindowPositionMemory } from './utils/window-position-memory';

describe('AlwaysOn position', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		windowOptions.length = 0;
		windowListeners = new Map();
		position = [16, 465];
		displays = [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }];
		delete storeData['windowPositions'];
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	/** The user drags the widget to x, y and lets it rest */
	const dragTo = (x: number, y: number) => {
		position = [x, y];
		windowListeners.get('move')();
		jest.advanceTimersByTime(WindowPositionMemory.SAVE_DELAY_MS);
	};

	it('opens at the default place the first time: the left edge, half-way down the primary display', () => {
		new AlwaysOn('index.html');

		expect(windowOptions[0]).toEqual(expect.objectContaining({ x: 16, y: Math.floor((1040 - 110) / 2) }));
	});

	it('opens where the user left it last time', () => {
		new AlwaysOn('index.html');
		dragTo(1700, 80);

		new AlwaysOn('index.html');

		expect(windowOptions[1]).toEqual(expect.objectContaining({ x: 1700, y: 80 }));
	});

	it('opens at the default place when the display it was left on is disconnected', () => {
		displays = [
			{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
			{ bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
		];
		new AlwaysOn('index.html');
		dragTo(2600, 300);

		displays = [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }];
		new AlwaysOn('index.html');

		expect(windowOptions[1]).toEqual(expect.objectContaining({ x: 16, y: Math.floor((1040 - 110) / 2) }));
	});

	it('remembers the compact and the expanded widget apart, as their sizes differ', () => {
		storeData['windowPositions'] = {
			[AlwaysOn.POSITION_KEYS.compact]: { x: 10, y: 10 },
			[AlwaysOn.POSITION_KEYS.expand]: { x: 900, y: 20 }
		};

		new AlwaysOn('index.html', 'preload.js', true, true);

		expect(windowOptions[0]).toEqual(expect.objectContaining({ x: 900, y: 20, width: 270, height: 45 }));
	});

	it('keeps the compact size and spot for a compact widget opened after an expanded one', () => {
		// Left at the bottom-right corner: restored with the wrong (expanded) size, it would be clamped elsewhere
		storeData['windowPositions'] = { [AlwaysOn.POSITION_KEYS.compact]: { x: 1860, y: 970 } };

		new AlwaysOn('index.html', 'preload.js', true, true);
		new AlwaysOn('index.html');

		expect(windowOptions[1]).toEqual(expect.objectContaining({ x: 1860, y: 970, width: 60, height: 110 }));
	});
});
