import { RegisteredWindow, store, WindowManager } from '@gauzy/desktop-core';
import { BrowserWindow } from 'electron';
import { LocalStore } from '../../desktop-store';
import { UserService } from '../../offline';
import { TranslateService } from '../../translation';
import { IConfigStore, ITranslationService, IUserRepository, IWindowService } from '../interfaces';

export class UserRepositoryAdapter implements IUserRepository {
	private userService: UserService;

	constructor() {
		this.userService = new UserService();
	}

	async save(user: any): Promise<void> {
		return this.userService.save(user);
	}

	async remove(): Promise<void> {
		return this.userService.remove();
	}
}

export class ConfigStoreAdapter implements IConfigStore {
	get(key: string): any {
		return store.get(key);
	}

	set(data: any): void {
		store.set(data);
	}

	getStore(key: string): any {
		return LocalStore.getStore(key);
	}

	updateConfigProject(config: any): void {
		LocalStore.updateConfigProject(config);
	}

	updateAuthSetting(setting: any): void {
		LocalStore.updateAuthSetting(setting);
	}
}

export class WindowServiceAdapter implements IWindowService {
	private manager: WindowManager;

	constructor() {
		this.manager = WindowManager.getInstance();
	}

	show(window: RegisteredWindow): void {
		this.manager.show(window);
	}

	hide(window: RegisteredWindow): void {
		this.manager.hide(window);
	}

	webContents(window: BrowserWindow): Electron.WebContents {
		return this.manager.webContents(window);
	}

	getOne(window: RegisteredWindow): BrowserWindow | undefined {
		return this.manager.getOne(window) as BrowserWindow;
	}
}

export class TranslationServiceAdapter implements ITranslationService {
	instant(key: string, params?: any): string {
		return TranslateService.instant(key, params);
	}

	onLanguageChange(callback: () => void): void {
		TranslateService.onLanguageChange(callback);
	}
}
