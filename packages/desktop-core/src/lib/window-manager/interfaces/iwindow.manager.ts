import { BrowserWindow, WebContents } from 'electron';
import { IBaseWindow } from './ibase-window';
export enum RegisteredWindow {
	ABOUT = 'about',
	IMAGE_VIEWER = 'image-viewer',
	SETTINGS = 'settings',
	SERVER = 'server',
	TIMER = 'timer',
	UPDATER = 'updater',
	WIDGET = 'widget',
	SPLASH = 'splash',
	MAIN = 'main',
	SETUP = 'setup',
	CAPTURE = 'capture'
}

export type IWindow = IBaseWindow | BrowserWindow;

export interface IWindowManager {
	register(name: RegisteredWindow, window: IWindow): void;

	unregister(name: RegisteredWindow): void;

	show(name: RegisteredWindow): void;

	hide(name: RegisteredWindow): void;

	getOne(name: RegisteredWindow): IWindow | null;

	getAll(): IWindow[];

	getActives(): IWindow[];

	webContents(window: IWindow): WebContents;

	close(name: RegisteredWindow): void;

	closeAll(): void;

	quit(): void;
}
