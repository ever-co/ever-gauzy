import {
	createAboutWindow,
	SplashScreen,
	createSetupWindow,
	AuthWindow,
	createSettingsWindow,
	createServerWindow,
	ScreenCaptureNotification
} from '@gauzy/desktop-window';
import { BrowserWindow } from 'electron';
import { resolveHtmlPath } from './util';
import * as path from 'path';

class AppWindow {
	aboutWindow: BrowserWindow | null;
	splashScreenWindow: SplashScreen;
	setupWindow: BrowserWindow;
	rootPath: string;
	authWindow: AuthWindow | null;
	settingWindow: BrowserWindow | null;
	logWindow: BrowserWindow | null;
	notificationWindow: ScreenCaptureNotification | null;
	private static instance: AppWindow;
	constructor(rootPath: string) {
		if (!AppWindow.instance) {
			AppWindow.instance = this;
			this.rootPath = rootPath;
		}
	}

	static getInstance(rootPath: string): AppWindow {
		if (!AppWindow.instance) {
			AppWindow.instance = new AppWindow(rootPath);
			return AppWindow.instance;
		}
		return AppWindow.instance;
	}

	getUiPath(hashPath: string) {
		return resolveHtmlPath('index.html', hashPath);
	}

	getPreloadPath() {
		return path.join(this.rootPath, 'main', 'preload.js');
	}

	async initAboutWindow() {
		try {
			if (!this.aboutWindow) {
				this.aboutWindow = await createAboutWindow(this.getUiPath('about'), this.getPreloadPath());
				this.aboutWindow.once('close', () => {
					this.aboutWindow.destroy();
					this.aboutWindow = null;
				});
				this.aboutWindow.once('ready-to-show', () => {
					this.aboutWindow.show();
				})
			}
		} catch (error) {
			console.error('Failed to initialize about window', error)
			throw new Error(`About window initialization failed: ${error.message}`);
		}
	}

	async initSplashScreenWindow() {
		try {
			if (!this.splashScreenWindow) {
				this.splashScreenWindow = new SplashScreen(this.getUiPath('splash-screen'), this.getPreloadPath(), true);
				this.splashScreenWindow.browserWindow.on('close', () => {
					this.splashScreenWindow.browserWindow.destroy();
					this.splashScreenWindow = null;
				});
			}
		} catch (error) {
			console.error('Failed to initialize splash screen window', error);
			throw new Error(`SplashScreen window initialization failed: ${error.message}`);
		}
	}

	async initSetupWindow() {
		try {
			if (!this.setupWindow) {
				this.setupWindow =  await createSetupWindow(
					this.setupWindow,
					true,
					this.getUiPath('setup'),
					this.getPreloadPath(),
					true
				);
				this.setupWindow.on('close', () => {
					console.log('on change setup window');
					this.setupWindow.destroy();
					this.setupWindow = null;
				});
			}
		} catch (error) {
			console.error('Failed to initialize setup window', error);
			throw new Error(`Setup window initialization failed: ${error.message}`);
		}
	}

	async initAuthWindow(): Promise<void> {
		try {
			if (!this.authWindow) {
				this.authWindow = new AuthWindow(this.getUiPath('auth/login'), this.getPreloadPath(), true);
				this.authWindow.config.options.titleBarStyle = 'hidden';
				this.authWindow.config.options.titleBarOverlay = true;
				this.authWindow.browserWindow.on('close', () => {
					this.destroyAuthWindow();
				});
			}
		} catch (error) {
			console.error('Failed to initialize auth window', error);
			throw new Error(`Auth Window initialization failed ${error.message}`);
		}
	}

	destroyAuthWindow() {
		this.authWindow.browserWindow.destroy();
		this.authWindow = null;
	}

	async initSettingWindow(): Promise<void> {
		try {
			if (!this.settingWindow) {
				this.settingWindow = await createSettingsWindow(
					null,
					this.getUiPath('settings'),
					this.getPreloadPath(),
					true
				);
				// this.settingWindow.webContents.toggleDevTools();
				this.settingWindow.removeAllListeners('close'); // remove the close default handle
				// override the close event
				this.settingWindow.on('close', () => {
					this.settingWindow.destroy();
					this.settingWindow = null;
				});
			}
		} catch (error) {
			console.error('Failed to initialize setting window', error);
			throw new Error(`Setting window initialization failed ${error.message}`);
		}
	}

	async initLogWindow(): Promise<void> {
		try {
			if (!this.logWindow || this.logWindow?.isDestroyed()) {
				console.log('this log window', this.logWindow);
				this.logWindow = await createServerWindow(
					null,
					this.getUiPath('server-dashboard'),
					this.getPreloadPath(),
					true
				);
				const maxHeight = 480;
				const maxWidth = 640;
				this.logWindow.setSize(maxWidth, maxHeight);
				// this.LogWindow.webContents.toggleDevTools();
				this.logWindow.on('close', () => {
					this.logWindow.hide();
				});
			}
		} catch (error) {
			console.error('Failed to initialize log window', error);
			throw new Error(`Log window initialization failed ${error.message}`);
		}
	}

	async initScreenShotNotification() {
		try {
			if (!this.notificationWindow) {
				this.notificationWindow = new ScreenCaptureNotification(this.getUiPath('screen-capture'), this.getPreloadPath());
				this.notificationWindow.loadURL();
				return;
			}
			this.notificationWindow.show();
		} catch (error) {

		}
	}

	closeSettingWindow() {
		if (this.settingWindow && !this.settingWindow?.isDestroyed) {
			this.settingWindow.close();
			this.settingWindow = null;
		}
	}

	closeLogWindow() {
		if (this.logWindow && !this.logWindow.isDestroyed) {
			this.logWindow.close();
			this.logWindow = null;
		}
	}
}

export default AppWindow;
