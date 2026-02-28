import { RegisteredWindow } from '@gauzy/desktop-core';
import { BrowserWindow, MenuItemConstructorOptions } from 'electron';

export interface IUserRepository {
	save(user: any): Promise<void>;
	remove(): Promise<void>;
}

export interface IConfigStore {
	get(key: string): any;
	set(data: any): void;
	getStore(key: string): any;
	updateConfigProject(config: any): void;
	updateAuthSetting(setting: any): void;
}

export interface IWindowService {
	show(window: RegisteredWindow): void;
	hide(window: RegisteredWindow): void;
	webContents(window: BrowserWindow): Electron.WebContents;
	getOne(window: RegisteredWindow): BrowserWindow | undefined;
}

export interface ITranslationService {
	instant(key: string, params?: any): string;
	onLanguageChange(callback: () => void): void;
}

export interface IMenuBuilder {
	build(): MenuItemConstructorOptions[];
}

export interface IMenuStrategy {
	buildMenu(): MenuItemConstructorOptions[];
}

export interface ITrayIconConfig {
	iconPath: string;
	windowPath: any;
	config: any;
}
