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
	aboutWindow: BrowserWindow | null = null;
	setupWindow: BrowserWindow | null = null;
	imageView: BrowserWindow | null = null;
	settingWindow: BrowserWindow | null = null;
	updater: DesktopUpdater = null;
	pluginsWindow: PluginMarketplaceWindow | null = null;
	alwaysOnWindow: AlwaysOn | null = null;

	private static instance: AppWindowManager;
	constructor() { };

	get _settingWindow(): BrowserWindow {
		return this.settingWindow;
	}

	set _updater(value: DesktopUpdater) {
		this.updater = value;
	}

	static getInstance(): AppWindowManager {
		if (!AppWindowManager.instance) {
			AppWindowManager.instance = new AppWindowManager();
		}
		return AppWindowManager.instance;
	}

	async initAboutWindow(filePath: string) {
		if (this.aboutWindow) {
			return;
		}
		this.aboutWindow = await createAboutWindow(filePath);
		this.eventCloseWindow(this.aboutWindow, WindowName.ABOUT);
	}

	async initSetupWindow(filePath: string): Promise<BrowserWindow> {
		if (this.setupWindow) {
			return this.setupWindow;
		}
		this.setupWindow = await createSetupWindow(this.setupWindow, false, filePath);
		this.eventCloseWindow(this.setupWindow, WindowName.SETUP);
		return this.setupWindow;
	}

	async initImageViewWindow(filePath: string): Promise<BrowserWindow> {
		if (this.imageView) {
			return this.imageView;
		}
		this.imageView = await createImageViewerWindow(this.imageView, filePath);
		this.eventCloseWindow(this.imageView, WindowName.IMAGE_VIEW);
		return this.imageView;
	}

	async initSettingWindow(filePath: string, preloadPath?: string): Promise<BrowserWindow> {
		if (this.settingWindow) {
			return this.settingWindow;
		}
		this.settingWindow = await createSettingsWindow(this.settingWindow, filePath, preloadPath);
		this.eventCloseWindow(this.settingWindow, WindowName.SETTING);
		return this.settingWindow;
	}

	async initPluginsWindow(filePath: string, preloadPath?: string): Promise<PluginMarketplaceWindow> {
		if (!this.pluginsWindow) {
			this.pluginsWindow = new PluginMarketplaceWindow(filePath);
			await this.pluginsWindow.loadURL();
		}
		this.pluginsWindow.browserWindow.removeAllListeners('close');
		this.pluginsWindow.browserWindow.on('close', () => {
			if (!this.pluginsWindow?.browserWindow?.isDestroyed()) {
				this.pluginsWindow?.browserWindow?.destroy();
			}

			this.pluginsWindow = null;
		});
		return this.pluginsWindow;
	}

	async initAlwaysOnWindow(filePath: string): Promise<AlwaysOn> {
		try {
			if (!this.alwaysOnWindow || this.alwaysOnWindow?.browserWindow?.isDestroyed()) {
				this.alwaysOnWindow = new AlwaysOn(filePath);
				await this.alwaysOnWindow.loadURL();
				this.alwaysOnWindow.browserWindow.removeAllListeners('close');
				this.alwaysOnWindow.browserWindow.on('close', () => {
					if (!this.alwaysOnWindow?.browserWindow?.isDestroyed()) {
						this.alwaysOnWindow?.browserWindow?.destroy();
					}
					this.alwaysOnWindow = null;
				});
			}
			return this.alwaysOnWindow;
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
				this.aboutWindow = null;
				break;
			case WindowName.SETUP:
				this.setupWindow = null;
				break;
			case WindowName.IMAGE_VIEW:
				this.imageView = null;
				break;
			case WindowName.SETTING:
				this.settingWindow = null;
				this.updater.settingWindow = null;
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

		this.settingWindow?.webContents?.send?.('app_setting', {
			...LocalStore.beforeRequestParams(),
			setting: appSetting,
			config: config,
			auth,
			additionalSetting: addSetting
		});

		this.settingWindow?.webContents?.send?.('setting_page_ipc', {
			type: nav
		});
		this.settingWindow?.webContents?.send?.('refresh_menu');
		if (this.updater) {
			this.updater.settingWindow = this.settingWindow;
		}
	}

}
