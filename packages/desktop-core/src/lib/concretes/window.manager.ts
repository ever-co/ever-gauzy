import { BrowserWindow, WebContents } from 'electron';
import log from 'electron-log';
import { IWindow, IWindowManager, RegisteredWindow } from '../interfaces/iwindow.manager';

export class WindowManager implements IWindowManager {
	private static instance: WindowManager | null = null;
	private windows: Map<RegisteredWindow, IWindow> = new Map();

	// Private constructor to enforce singleton pattern
	private constructor() {}

	/**
	 * Retrieves the singleton instance of WindowManager.
	 * Creates a new instance if none exists.
	 */
	public static getInstance(): WindowManager {
		if (!WindowManager.instance) {
			WindowManager.instance = new WindowManager();
		}
		return WindowManager.instance;
	}

	/**
	 * Registers a new window with the given name.
	 * @param name - The unique name for the window.
	 * @param window - The window instance to register.
	 */
	public register(name: RegisteredWindow, window: IWindow): void {
		if (this.windows.has(name)) {
			log.warn(`Window with name "${name}" already exists.`);
			return;
		}
		this.windows.set(name, window);
		log.info(`Window with name "${name}" registered successfully.`);
	}

	/**
	 * Unregisters a window by its name.
	 * @param name - The unique name of the window to unregister.
	 * @returns `true` if the window was successfully unregistered; otherwise, `false`.
	 */
	public unregister(name: RegisteredWindow): boolean {
		const removed = this.windows.delete(name);
		if (removed) {
			log.info(`Window with name "${name}" unregistered successfully.`);
		} else {
			log.warn(`Window with name "${name}" does not exist.`);
		}
		return removed;
	}

	/**
	 * Displays the window with the given name.
	 * @param name - The unique name of the window to show.
	 * @throws Error if the window does not exist.
	 */
	public show(name: RegisteredWindow): void {
		const window = this.windows.get(name);
		if (!window) {
			log.error(`Cannot show. Window with name "${name}" not found.`);
			throw new Error(`Window "${name}" not found.`);
		}
		window.show();
		log.info(`Window with name "${name}" is now visible.`);
	}

	/**
	 * Hides the window with the given name.
	 * @param name - The unique name of the window to hide.
	 * @throws Error if the window does not exist.
	 */
	public hide(name: RegisteredWindow): void {
		const window = this.windows.get(name);
		if (!window) {
			log.error(`Cannot hide. Window with name "${name}" not found.`);
			return;
		}
		window.hide();
		log.info(`Window with name "${name}" is now hidden.`);
	}

	/**
	 * Retrieves a single window by its name.
	 * @param name - The unique name of the window to retrieve.
	 * @returns The window instance if found, or `null` if not found.
	 */
	public getOne(name: RegisteredWindow): IWindow | null {
		const window = this.windows.get(name);
		if (!window) {
			log.warn(`Window with name "${name}" not found.`);
			return null;
		}
		return window;
	}

	/**
	 * Retrieves all registered windows.
	 * @returns An array of all registered window instances.
	 */
	public getAll(): IWindow[] {
		return Array.from(this.windows.values());
	}

	/**
	 * Retrieves all active windows.
	 * @returns An array of active window instances.
	 */
	public getActives(): IWindow[] {
		return this.getAll().filter((window) => {
			if (window instanceof BrowserWindow) {
				return window.isVisible();
			} else {
				return window.browserWindow?.isVisible() ?? false;
			}
		});
	}

	/**
	 * Retrieves the `WebContents` of a given window.
	 * @param window - The window instance.
	 * @returns The WebContents instance of the window.
	 * @throws Error if the WebContents cannot be retrieved.
	 */
	public webContents(window: IWindow): WebContents {
		if (window instanceof BrowserWindow) {
			return window.webContents;
		} else if (window.browserWindow) {
			return window.browserWindow.webContents;
		} else {
			log.error(`Cannot retrieve WebContents. Invalid window instance.`);
			throw new Error(`Invalid window instance.`);
		}
	}

	/**
	 * Closes the window with the given name and unregisters it.
	 * @param name - The unique name of the window to close.
	 * @throws Error if the window does not exist.
	 */
	public close(name: RegisteredWindow): void {
		const window = this.windows.get(name);
		if (!window) {
			log.error(`Cannot close. Window with name "${name}" not found.`);
			throw new Error(`Window "${name}" not found.`);
		}
		window.close();
		this.unregister(name);
		log.info(`Window with name "${name}" closed and unregistered.`);
	}

	/**
	 * Closes all registered windows and clears the registry.
	 */
	public closeAll(): void {
		this.windows.forEach((window) => {
			window.close();
		});
		this.windows.clear();
		log.info(`All windows closed and registry cleared.`);
	}

	/**
	 * Closes all windows and quits the application.
	 */
	public quit(): void {
		this.closeAll();
		log.info(`Application is quitting.`);
		process.exit(0);
	}
}
