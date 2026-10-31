/**
 * "Capture active monitor" used to pick the display by comparing only the cursor's x coordinate
 * (vertically stacked monitors always resolved to the first one, #5855) and produced nothing at
 * all when the screenshot library reported a display id Electron did not know (#7771).
 *
 * Electron and screenshot-desktop cannot run here, so both are mocked: `screen` answers with two
 * displays stacked vertically and `screenshot.listDisplays()` with whatever ids a test needs.
 */
const displays = [
	{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
	{ id: 2, bounds: { x: 0, y: 1080, width: 1920, height: 1080 } }
];
let cursor = { x: 100, y: 100 };

jest.mock(
	'electron',
	() => ({
		app: { getPath: () => '/tmp', quit: jest.fn() },
		screen: {
			getAllDisplays: () => displays,
			getCursorScreenPoint: () => cursor,
			// Electron resolves the display on both axes; the mock does the same on the fixture above.
			getDisplayNearestPoint: (point: { x: number; y: number }) =>
				displays.find(
					(display) =>
						point.x >= display.bounds.x &&
						point.x < display.bounds.x + display.bounds.width &&
						point.y >= display.bounds.y &&
						point.y < display.bounds.y + display.bounds.height
				) ?? displays[0]
		}
	}),
	{ virtual: true }
);

const listDisplays = jest.fn();
jest.mock(
	'screenshot-desktop',
	() => {
		const shot: any = jest.fn(async ({ screen }: { screen: string }) => Buffer.from(`img-${screen}`));
		shot.listDisplays = () => listDisplays();
		return { __esModule: true, default: shot };
	},
	{ virtual: true }
);
jest.mock('form-data', () => class {}, { virtual: true });

const appSetting = { monitor: { captured: 'active-only' } };
const auth: { current: Record<string, unknown> | null } = { current: { allowScreenshotCapture: true } };
jest.mock('./desktop-store', () => ({
	LocalStore: {
		getStore: jest.fn((key: string) => {
			if (key === 'auth') return auth.current;
			if (key === 'appSetting') return appSetting;
			return {};
		}),
		beforeRequestParams: () => ({})
	}
}));

import { captureScreen, detectActiveWindow, getScreenshot } from './desktop-screenshot';

describe('detectActiveWindow', () => {
	it('picks the display under the cursor when monitors are stacked vertically', () => {
		cursor = { x: 100, y: 1500 };

		expect(detectActiveWindow()).toEqual(expect.objectContaining({ id: 2, index: 1 }));
	});

	it('picks the first display when the cursor is on it', () => {
		cursor = { x: 100, y: 100 };

		expect(detectActiveWindow()).toEqual(expect.objectContaining({ id: 1, index: 0 }));
	});
});

describe('getScreenshot in active-only mode', () => {
	beforeEach(() => {
		appSetting.monitor.captured = 'active-only';
		cursor = { x: 100, y: 1500 };
	});

	it('returns only the active display when the library reports the same ids as Electron', async () => {
		listDisplays.mockResolvedValue([{ id: '1' }, { id: '2' }]);

		const result = await getScreenshot();

		expect(result.map((display) => display.id)).toEqual(['2']);
	});

	it('falls back to the captured display when no id matches the active one', async () => {
		// The library sees a single display with no id while Electron puts the cursor on the second
		// one: nothing can be matched, and the old code answered `[undefined]`.
		listDisplays.mockResolvedValue([{ id: '' }]);

		const result = await getScreenshot();

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(expect.objectContaining({ id: '', name: 'Screen 0' }));
		expect(Buffer.isBuffer(result[0].img)).toBe(true);
	});

	it('captures one display, not every display, when the library reports no ids', async () => {
		// Two displays the library reports without ids: "active only" must not upload both
		listDisplays.mockResolvedValue([{ id: '' }, { id: '' }]);

		const result = await getScreenshot();

		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(expect.objectContaining({ name: 'Screen 1' }));
	});

	it('returns every display in "all" mode', async () => {
		appSetting.monitor.captured = 'all';
		listDisplays.mockResolvedValue([{ id: '1' }, { id: '2' }]);

		const result = await getScreenshot();

		expect(result.map((display) => display.id).sort()).toEqual(['1', '2']);
	});
});

/**
 * Issue #9872: the screen is captured only when the organization and the employee both allow it. The employee's own
 * setting (stored at sign-in) used to be enough, so an employee was still captured while their organization was off.
 */
describe('screen capture permission', () => {
	/** Whether the timer captures: `detectActiveWindow` answers nothing and no display is listed when it may not */
	const captures = async () => {
		listDisplays.mockClear();
		const active = detectActiveWindow();
		await captureScreen({ webContents: { send: jest.fn() } }, null, 'slot-1', false, null, null);
		const listed = listDisplays.mock.calls.length > 0;
		expect(listed).toBe(active !== undefined);
		return listed;
	};

	beforeEach(() => {
		cursor = { x: 100, y: 100 };
		listDisplays.mockResolvedValue([]);
	});

	afterAll(() => {
		auth.current = { allowScreenshotCapture: true };
	});

	it('does not capture an employee who allows it while the organization does not', async () => {
		// What the timer stores once it has read the user: the employee allows it, the organization does not
		auth.current = {
			allowScreenshotCapture: false,
			user: { employee: { allowScreenshotCapture: true, organization: { allowScreenshotCapture: false } } }
		};

		expect(await captures()).toBe(false);
	});

	it('follows the combined setting the timer read last over the employee stored at sign-in', async () => {
		auth.current = { allowScreenshotCapture: true, user: { employee: { allowScreenshotCapture: false } } };

		expect(await captures()).toBe(true);
	});

	it('before the timer has read the user, captures only when the employee and organization stored at sign-in allow it', async () => {
		auth.current = {
			user: { employee: { allowScreenshotCapture: true, organization: { allowScreenshotCapture: true } } }
		};
		expect(await captures()).toBe(true);

		auth.current = {
			user: { employee: { allowScreenshotCapture: true, organization: { allowScreenshotCapture: false } } }
		};
		expect(await captures()).toBe(false);

		// No organization stored: not known to allow it
		auth.current = { user: { employee: { allowScreenshotCapture: true } } };
		expect(await captures()).toBe(false);
	});

	it('does not capture when signed out', async () => {
		auth.current = null;

		expect(await captures()).toBe(false);
	});
});
