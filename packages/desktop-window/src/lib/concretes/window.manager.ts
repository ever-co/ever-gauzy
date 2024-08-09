import { BrowserWindow, WebContents } from 'electron';
import log from 'electron-log';
import { IWindow, IWindowManager, RegisteredWindow } from '../interfaces/iwindow.manager';

export class WindowManager implements IWindowManager {
	private windows: Map<RegisteredWindow, IWindow> = new Map();
	private static instance: WindowManager;

	private constructor() {
		// Private constructor to prevent instantiation from outside
	}

	public static getInstance(): WindowManager {
		if (!this.instance) {
			this.instance = new WindowManager();
		}
		return this.instance;
	}

	public register(name: RegisteredWindow, window: IWindow): void {
		if (this.windows.has(name)) {
			log.warn(`Window with name ${name} already exists.`);
			return;
		}
		log.info(`Window with name ${name} register.`);
		this.windows.set(name, window);
	}

	public unregister(name: RegisteredWindow): void {
		this.windows.delete(name);
		log.info(`Window with name ${name} unregister.`);
	}

	public show(name: RegisteredWindow): void {
		const window = this.windows.get(name);
		if (window) {
			window.show();
		}
	}

	public hide(name: RegisteredWindow): void {
		const window = this.windows.get(name);
		if (window) {
			window.hide();
		}
	}

	public getOne(name: RegisteredWindow): IWindow {
		const window = this.windows.get(name);
		if (!window) {
			log.warn(`WARN::Window with name ${name} not found.`);
			return null;
		}
		return window;
	}

	public getAll(): IWindow[] {
		return Array.from(this.windows.values());
	}

	public getActives(): IWindow[] {
		return this.getAll().filter((window) => {
			if (window instanceof BrowserWindow) {
				return !!window;
			} else {
				return !!window?.browserWindow;
			}
		});
	}

	public webContents(window: IWindow): WebContents {
		if (window instanceof BrowserWindow) {
			return window?.webContents;
		} else {
			return window.browserWindow?.webContents;
		}
	}

	public close(name: RegisteredWindow): void {
		const window = this.windows.get(name);
		if (window) {
			window.close();
			this.unregister(name);
		}
		log.info(`Window with name ${name} closed.`);
	}

	public closeAll(): void {
		this.windows.forEach((window) => window.close());
		this.windows.clear();
	}

	public quit(): void {
		// Close all windows and quit the application
		this.closeAll();
		process.exit(0);
	}
}
