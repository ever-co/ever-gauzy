import { IWindowPosition, store } from '@gauzy/desktop-core';
import { BrowserWindow, screen } from 'electron';
import { IScreenRectangle, IWindowSize, restoreWindowPosition } from './window-position';

/** Where window positions are kept, by window key. */
export interface IWindowPositionStorage {
	get(key: string): unknown;
	set(key: string, position: IWindowPosition): void;
}

/**
 * The app's electron-store, under `windowPositions`: on this computer only, and apart from `appSetting` (which the
 * settings page writes back whole, and would put an older position back).
 */
export const windowPositionStore: IWindowPositionStorage = {
	get: (key) => store.get('windowPositions')?.[key],
	set: (key, position) => store.set('windowPositions', { ...(store.get('windowPositions') ?? {}), [key]: position })
};

/** The bounds of the displays connected now. */
function connectedDisplays(): IScreenRectangle[] {
	return screen.getAllDisplays().map((display) => display.bounds);
}

/**
 * Remembers where the user leaves a window and puts it back there the next time it is created (#7683), as long as
 * that spot is on a connected display.
 *
 * ```ts
 * const memory = new WindowPositionMemory('always-on-compact');
 * const position = memory.restore({ width, height }) ?? defaultPosition; // before the window is created
 * memory.track(browserWindow); // once it is created
 * ```
 */
export class WindowPositionMemory {
	/** How long a window rests after a move before its position is written (a drag reports many moves). */
	public static readonly SAVE_DELAY_MS = 500;

	/** The last position seen and not written yet. */
	private pending: IWindowPosition | null = null;
	private saveTimeout: ReturnType<typeof setTimeout> | null = null;

	/**
	 * @param key The window, unique across the app (one per size of a window: a saved spot depends on the size).
	 * @param storage Where positions are kept, the app's electron-store by default.
	 */
	constructor(
		private readonly key: string,
		private readonly storage: IWindowPositionStorage = windowPositionStore
	) {}

	/**
	 * Where the window was last left, moved onto the displays connected now (see {@link restoreWindowPosition}), or
	 * `null` when nothing was saved or that spot is on no connected display: the caller then keeps its default.
	 */
	public restore(
		size: IWindowSize,
		displays: readonly IScreenRectangle[] = connectedDisplays()
	): IWindowPosition | null {
		try {
			return restoreWindowPosition(this.storage.get(this.key) as IWindowPosition, size, displays);
		} catch (error) {
			console.warn(`Could not restore the position of the "${this.key}" window`, error);
			return null;
		}
	}

	/** Saves where the user moves the window: once it rests a moment, and when it is closed. */
	public track(window: BrowserWindow): void {
		window.on('move', () => {
			if (window.isDestroyed()) {
				return;
			}
			const [x, y] = window.getPosition();
			this.pending = { x, y };
			this.scheduleSave();
		});
		window.on('closed', () => this.flush());
	}

	/** Writes the last position seen now, if it was not written yet. */
	public flush(): void {
		this.clearSaveTimeout();
		const position = this.pending;
		if (!position) {
			return;
		}
		try {
			this.storage.set(this.key, position);
			// Kept until written: a failed timed save is tried again when the window closes
			this.pending = null;
		} catch (error) {
			console.warn(`Could not save the position of the "${this.key}" window`, error);
		}
	}

	private scheduleSave(): void {
		this.clearSaveTimeout();
		this.saveTimeout = setTimeout(() => this.flush(), WindowPositionMemory.SAVE_DELAY_MS);
	}

	private clearSaveTimeout(): void {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
			this.saveTimeout = null;
		}
	}
}
