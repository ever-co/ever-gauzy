import { BrowserWindow } from 'electron';
import { IWindowConfig } from './iwindow-config';

export interface IBaseWindow {
	loadURL(): Promise<void>;
	show(): void;
	close(): void;
	hide(): void;
	get browserWindow(): BrowserWindow | null;
	config: IWindowConfig;
}
