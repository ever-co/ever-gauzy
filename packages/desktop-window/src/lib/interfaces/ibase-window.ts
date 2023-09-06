import { BrowserWindow } from 'electron';

export interface IBaseWindow {
	loadURL(): Promise<void>;
	show(): void;
	close(): void;
	hide(): void;
	get browserWindow(): BrowserWindow;
}
