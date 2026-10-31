/**
 * The mini timer remembers where the user leaves it (#7683). Electron and the app's electron-store cannot run here:
 * `screen` answers with the displays a test needs, and the store is an in-memory object.
 */
let displays = [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }];
jest.mock('electron', () => ({ screen: { getAllDisplays: () => displays } }), { virtual: true });

const storeData: Record<string, any> = {};
jest.mock('@gauzy/desktop-core', () => ({
	store: {
		get: (key: string) => storeData[key],
		set: (key: string, value: unknown) => {
			storeData[key] = value;
		}
	}
}));

import { IWindowPositionStorage, WindowPositionMemory, windowPositionStore } from './window-position-memory';

/** A BrowserWindow stub that can be moved and destroyed. */
function fakeWindow(position: [number, number] = [16, 485]) {
	const listeners = new Map<string, () => void>();
	let destroyed = false;
	const window = {
		on: jest.fn((event: string, listener: () => void) => listeners.set(event, listener)),
		getPosition: jest.fn(() => position),
		isDestroyed: () => destroyed,
		/** The user drags the window to x, y (Electron reports `move`) */
		moveTo(x: number, y: number) {
			position = [x, y];
			listeners.get('move')?.();
		},
		/** The window is destroyed (Electron reports `closed`) */
		destroy() {
			destroyed = true;
			listeners.get('closed')?.();
		}
	};
	return window;
}

describe('WindowPositionMemory', () => {
	let storage: IWindowPositionStorage & { saved: Record<string, unknown> };

	beforeEach(() => {
		jest.useFakeTimers();
		displays = [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }];
		const saved: Record<string, unknown> = {};
		storage = {
			saved,
			get: jest.fn((key: string) => saved[key]),
			set: jest.fn((key: string, position) => {
				saved[key] = position;
			})
		};
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('has no position before the window was ever moved: the caller keeps its default', () => {
		expect(new WindowPositionMemory('widget', storage).restore({ width: 60, height: 110 })).toBeNull();
	});

	it('saves where the user leaves the window once it rests, and restores it next time', () => {
		const window = fakeWindow();
		new WindowPositionMemory('widget', storage).track(window as any);

		window.moveTo(100, 100);
		window.moveTo(400, 300);
		window.moveTo(800, 600);
		expect(storage.set).not.toHaveBeenCalled();

		jest.advanceTimersByTime(WindowPositionMemory.SAVE_DELAY_MS);
		// One write for the whole drag, with where it ended
		expect(storage.set).toHaveBeenCalledTimes(1);
		expect(storage.saved['widget']).toEqual({ x: 800, y: 600 });

		expect(new WindowPositionMemory('widget', storage).restore({ width: 60, height: 110 })).toEqual({
			x: 800,
			y: 600
		});
	});

	it('saves a move made right before the window is closed', () => {
		const window = fakeWindow();
		new WindowPositionMemory('widget', storage).track(window as any);

		window.moveTo(1200, 50);
		window.destroy();

		expect(storage.saved['widget']).toEqual({ x: 1200, y: 50 });
		// Nothing is left to write afterwards
		jest.advanceTimersByTime(WindowPositionMemory.SAVE_DELAY_MS);
		expect(storage.set).toHaveBeenCalledTimes(1);
	});

	it('writes nothing when the window closes without having been moved', () => {
		const window = fakeWindow();
		new WindowPositionMemory('widget', storage).track(window as any);

		window.destroy();

		expect(storage.set).not.toHaveBeenCalled();
	});

	it('falls back to the default when the display the window was on is disconnected', () => {
		storage.saved['widget'] = { x: 2500, y: 400 };

		const memory = new WindowPositionMemory('widget', storage);
		displays = [
			{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
			{ bounds: { x: 1920, y: 0, width: 1920, height: 1080 } }
		];
		expect(memory.restore({ width: 60, height: 110 })).toEqual({ x: 2500, y: 400 });

		displays = [{ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }];
		expect(memory.restore({ width: 60, height: 110 })).toBeNull();
	});

	it('keeps each window apart', () => {
		storage.saved['compact'] = { x: 10, y: 20 };
		storage.saved['expand'] = { x: 500, y: 20 };

		expect(new WindowPositionMemory('compact', storage).restore({ width: 60, height: 110 })).toEqual({
			x: 10,
			y: 20
		});
		expect(new WindowPositionMemory('expand', storage).restore({ width: 270, height: 45 })).toEqual({
			x: 500,
			y: 20
		});
	});

	it('never breaks the window when the storage fails', () => {
		const failing: IWindowPositionStorage = {
			get: () => {
				throw new Error('corrupt store');
			},
			set: () => {
				throw new Error('read-only disk');
			}
		};
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		const memory = new WindowPositionMemory('widget', failing);
		const window = fakeWindow();
		memory.track(window as any);

		expect(memory.restore({ width: 60, height: 110 })).toBeNull();
		window.moveTo(5, 5);
		expect(() => jest.advanceTimersByTime(WindowPositionMemory.SAVE_DELAY_MS)).not.toThrow();
		expect(warn).toHaveBeenCalledTimes(2);
		warn.mockRestore();
	});

	it('tries a failed save again when the window closes', () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		storage.set = jest
			.fn()
			.mockImplementationOnce(() => {
				throw new Error('store busy');
			})
			.mockImplementation((key: string, position) => {
				storage.saved[key] = position;
			});
		const window = fakeWindow();
		new WindowPositionMemory('widget', storage).track(window as any);

		window.moveTo(640, 360);
		jest.advanceTimersByTime(WindowPositionMemory.SAVE_DELAY_MS);
		expect(storage.saved['widget']).toBeUndefined();

		window.destroy();

		expect(storage.saved['widget']).toEqual({ x: 640, y: 360 });
		expect(storage.set).toHaveBeenCalledTimes(2);
		warn.mockRestore();
	});
});

describe('windowPositionStore', () => {
	it('keeps the positions of all windows under one key of the app store, apart from the app settings', () => {
		windowPositionStore.set('always-on-compact', { x: 1, y: 2 });
		windowPositionStore.set('always-on-expand', { x: 3, y: 4 });

		expect(storeData['windowPositions']).toEqual({
			'always-on-compact': { x: 1, y: 2 },
			'always-on-expand': { x: 3, y: 4 }
		});
		expect(windowPositionStore.get('always-on-compact')).toEqual({ x: 1, y: 2 });
		expect(storeData['appSetting']).toBeUndefined();
	});
});
