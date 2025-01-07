import { BrowserWindow } from 'electron';
import { IWindowConfig } from './iwindow-config';
import { IBaseWindow } from './ibase-window';

export abstract class BaseWindow {
	private _baseWindow: IBaseWindow;

	constructor(private readonly window: IBaseWindow) {
		this._baseWindow = window;
	}

	public async loadURL(): Promise<void> {
		await this._baseWindow.loadURL();
	}

	public show(): void {
		this._baseWindow.show();
	}

	public close(): void {
		this._baseWindow.close();
	}

	public hide(): void {
		this._baseWindow.hide();
	}

	public get browserWindow(): BrowserWindow | null {
		return this._baseWindow.browserWindow;
	}

	public get config(): IWindowConfig {
		return this._baseWindow.config;
	}
}
