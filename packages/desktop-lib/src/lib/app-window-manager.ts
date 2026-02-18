import { LocalStore } from './desktop-store';
import { BrowserWindow } from 'electron';
import {
	createAboutWindow,
	createSetupWindow,
	createImageViewerWindow,
	createSettingsWindow,
	PluginMarketplaceWindow,
	AlwaysOn
} from '@gauzy/desktop-window';
import { DesktopUpdater } from './desktop-updater';

enum WindowName {
	ABOUT = 'about',
	SETUP = 'setup',
	IMAGE_VIEW = 'imageView',
	SETTING = 'setting'
}

export class AppWindowManager {
	private _aboutWindow: BrowserWindow | null = null;
	private _setupWindow: BrowserWindow | null = null;
	private _imageView: BrowserWindow | null = null;
	private _settingWindow: BrowserWindow | null = null;
	private _updater: DesktopUpdater = null;
	private _pluginsWindow: PluginMarketplaceWindow | null = null;
	private _alwaysOnWindow: AlwaysOn | null = null;
	private _preloadPath: string = null;

	private static instance: AppWindowManager;
	constructor() { };

	get settingWindow(): BrowserWindow {
		return this._settingWindow;
	}

	get aboutWindow(): BrowserWindow {
		return this._aboutWindow;
	}

	get setupWindow(): BrowserWindow {
		return this._setupWindow;
	}

	get imageView(): BrowserWindow {
		return this._imageView;
	}

	get pluginsWindow(): PluginMarketplaceWindow {
		return this._pluginsWindow;
	}

	get alwaysOnWindow(): AlwaysOn {
		return this._alwaysOnWindow;
	}

	set updater(value: DesktopUpdater) {
		this._updater = value;
	}

	set preloadPath(value: string) {
		this._preloadPath = value;
	}

	static getInstance(): AppWindowManager {
		if (!AppWindowManager.instance) {
			AppWindowManager.instance = new AppWindowManager();
		}
		return AppWindowManager.instance;
	}

	async initAboutWindow(filePath: string) {
		if (this._aboutWindow) {
			return;
		}
		this._aboutWindow = await createAboutWindow(filePath, this._preloadPath);
		this.eventCloseWindow(this._aboutWindow, WindowName.ABOUT);
	}

	async initSetupWindow(filePath: string): Promise<BrowserWindow> {
		if (this._setupWindow) {
			return this._setupWindow;
		}
		this._setupWindow = await createSetupWindow(this._setupWindow, false, filePath);
		this.eventCloseWindow(this._setupWindow, WindowName.SETUP);
		return this._setupWindow;
	}

	async initImageViewWindow(filePath: string): Promise<BrowserWindow> {
		if (this._imageView) {
			return this._imageView;
		}
		this._imageView = await createImageViewerWindow(this._imageView, filePath, this._preloadPath);
		this.eventCloseWindow(this._imageView, WindowName.IMAGE_VIEW);
		return this._imageView;
	}

	async initSettingWindow(filePath: string, preloadPath?: string): Promise<BrowserWindow> {
		if (this._settingWindow) {
			return this._settingWindow;
		}
		this._settingWindow = await createSettingsWindow(this._settingWindow, filePath, this._preloadPath || preloadPath);
		this.eventCloseWindow(this._settingWindow, WindowName.SETTING);
		return this._settingWindow;
	}

	async initPluginsWindow(filePath: string, preloadPath?: string): Promise<PluginMarketplaceWindow> {
		if (!this._pluginsWindow) {
			this._pluginsWindow = new PluginMarketplaceWindow(filePath, this._preloadPath || preloadPath);
			await this._pluginsWindow.loadURL();
		}
		this._pluginsWindow.browserWindow.removeAllListeners('close');
		this._pluginsWindow.browserWindow.on('close', () => {
			if (!this._pluginsWindow?.browserWindow?.isDestroyed()) {
				this._pluginsWindow?.browserWindow?.destroy();
			}

			this._pluginsWindow = null;
		});
		return this._pluginsWindow;
	}

	async initAlwaysOnWindow(filePath: string): Promise<AlwaysOn> {
		try {
			if (!this._alwaysOnWindow || this._alwaysOnWindow?.browserWindow?.isDestroyed()) {
				this._alwaysOnWindow = new AlwaysOn(filePath);
				await this._alwaysOnWindow.loadURL();
				this._alwaysOnWindow.browserWindow.removeAllListeners('close');
				this._alwaysOnWindow.browserWindow.on('close', () => {
					if (!this._alwaysOnWindow?.browserWindow?.isDestroyed()) {
						this._alwaysOnWindow?.browserWindow?.destroy();
					}
					this._alwaysOnWindow = null;
				});
			}
			return this._alwaysOnWindow;
		} catch (error) {
			console.error('Failed to initialize always-on window', error);
			throw new Error(`Always-on window initialization failed: ${error.message}`);
		}
	}

	eventCloseWindow(window: BrowserWindow, windowName: WindowName) {
		window.once('close', () => {
			window.destroy();
			this.clearWindow(windowName);
		});
	}

	clearWindow(windowName: WindowName) {
		switch (windowName) {
			case WindowName.ABOUT:
				this._aboutWindow = null;
				break;
			case WindowName.SETUP:
				this._setupWindow = null;
				break;
			case WindowName.IMAGE_VIEW:
				this._imageView = null;
				break;
			case WindowName.SETTING:
				this._settingWindow = null;
				if (this._updater) {
					this._updater.settingWindow = null;
				}
				break;
			default:
				break;
		}
	}

	settingShow(
		nav: 'goto_top_menu' | 'goto_update'
	) {
		const appSetting = LocalStore.getStore('appSetting');
		const config = LocalStore.getStore('configs');
		const auth = LocalStore.getStore('auth');
		const addSetting = LocalStore.getStore('additionalSetting');

		this._settingWindow?.webContents?.send?.('app_setting', {
			...LocalStore.beforeRequestParams(),
			setting: appSetting,
			config: config,
			auth,
			additionalSetting: addSetting
		});

		this._settingWindow?.webContents?.send?.('setting_page_ipc', {
			type: nav
		});
		this._settingWindow?.webContents?.send?.('refresh_menu');
		if (this._updater) {
			this._updater.settingWindow = this._settingWindow;
		}
	}

}
