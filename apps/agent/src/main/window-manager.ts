import {
	createAboutWindow,
	SplashScreen,
	createSetupWindow,
	AuthWindow,
	createSettingsWindow
} from '@gauzy/desktop-window';
import { BrowserWindow } from 'electron';
import { resolveHtmlPath } from './util';
import * as path from 'path';

class AppWindow {
	aboutWindow: BrowserWindow | null;
	splashScreenWindow: SplashScreen;
	setupWindow: BrowserWindow;
	rootPath: string;
	authWindow: AuthWindow;
	settingWindow: BrowserWindow;
	private static instance: AppWindow;
	constructor(rootPath: string) {
		if (AppWindow.instance) {
			return AppWindow.instance;
		}
		AppWindow.instance= this;
		this.rootPath = rootPath;
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
				this.authWindow.config.options.frame = false;
				this.authWindow.browserWindow.on('close', () => {
					this.authWindow.browserWindow.destroy();
				});
				this.authWindow.browserWindow.webContents.toggleDevTools();
			}
		} catch (error) {
			console.error('Failed to initialize auth window', error);
			throw new Error(`Auth Window initialization failed ${error.message}`);
		}
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
				this.settingWindow.webContents.toggleDevTools();
				this.settingWindow.removeAllListeners('close'); // remove the close default handle
				// override the close event
				this.settingWindow.on('close', () => {
					this.settingWindow.destroy();
					this.settingWindow = null;
				});
			};
		} catch (error) {
			console.error('Failed to initialize setting window', error);
			throw new Error(`Setting window initialization failed ${error.message}`);
		}
	}
}

export default AppWindow;
