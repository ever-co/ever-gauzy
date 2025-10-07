import {
	createAboutWindow,
	SplashScreen,
	createSetupWindow,
	AuthWindow,
	createSettingsWindow,
	createServerWindow,
	ScreenCaptureNotification,
	AlwaysOn
} from '@gauzy/desktop-window';
import { app, BrowserWindow, screen } from 'electron';
import { resolveHtmlPath, getInitialConfig } from './util';
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
	alwaysOnWindow: AlwaysOn | null;
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

	hasActiveWindow() {
		return BrowserWindow.getAllWindows().some((win) => win.isVisible());
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
					this.dockHideHandle();
				});
				this.aboutWindow.once('ready-to-show', () => {
					this.aboutWindow.show();
				});
			}
		} catch (error) {
			console.error('Failed to initialize about window', error);
			throw new Error(`About window initialization failed: ${error.message}`);
		}
	}

	async initSplashScreenWindow() {
		try {
			if (!this.splashScreenWindow) {
				this.splashScreenWindow = new SplashScreen(
					this.getUiPath('splash-screen'),
					this.getPreloadPath(),
					true
				);
				this.splashScreenWindow.browserWindow.on('close', () => {
					this.splashScreenWindow.browserWindow.destroy();
					this.splashScreenWindow = null;
					this.dockHideHandle();
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
				this.setupWindow = await createSetupWindow(
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
					this.dockHideHandle();

					/* terminate app when the setup close without complete the setup process */
					const config = getInitialConfig();
					if (!config.isSetup) {
						app.quit();
					}
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
		if (this.authWindow?.browserWindow && !this.authWindow.browserWindow.isDestroyed()) {
			this.authWindow.browserWindow.destroy();
		}
		this.authWindow = null;
		this.dockHideHandle();
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
					this.dockHideHandle();
				});
			}
		} catch (error) {
			console.error('Failed to initialize setting window', error);
			throw new Error(`Setting window initialization failed ${error.message}`);
		}
	}

	dockHideHandle(): void {
		if (!this.hasActiveWindow()) {
			if (process.platform === 'darwin') {
				app.dock.hide();
			}
		}
	}

	async initLogWindow(): Promise<void> {
		try {
			if (!this.logWindow || this.logWindow?.isDestroyed()) {
				this.logWindow = await createServerWindow(
					null,
					this.getUiPath('server-dashboard'),
					this.getPreloadPath(),
					true
				);
				const desiredHeight = 860;
				const desiredWidth = 1200;
				const { width, height } = screen.getPrimaryDisplay().workAreaSize;
				const initialWidth = Math.min(desiredWidth, width);
				const initialHeight = Math.min(desiredHeight, height);
				this.logWindow.setSize(initialWidth, initialHeight);
				this.logWindow.setMinimumSize(Math.min(initialWidth, width), Math.min(initialHeight, height));
				this.logWindow.setResizable(true);
				this.logWindow.on('close', () => {
					this.logWindow.hide();
				});

				this.logWindow.on('hide', () => {
					this.dockHideHandle();
				});
			}
		} catch (error) {
			console.error('Failed to initialize log window', error);
			throw new Error(`Log window initialization failed ${error.message}`);
		}
	}

	async initAlwaysOnWindow(): Promise<void> {
		try {
			if (!this.alwaysOnWindow || this.alwaysOnWindow?.browserWindow?.isDestroyed()) {
				this.alwaysOnWindow = new AlwaysOn(this.getUiPath('always-on'), this.getPreloadPath(), true, true);
				this.alwaysOnWindow.browserWindow.removeAllListeners('close');
				this.alwaysOnWindow.browserWindow.on('close', () => {
					if (!this.alwaysOnWindow?.browserWindow?.isDestroyed()) {
						this.alwaysOnWindow?.browserWindow?.destroy();
					}

					this.alwaysOnWindow = null;
				});
			}
		} catch (error) {
			console.error('Failed to initialize always-on window', error);
			throw new Error(`Always-on window initialization failed: ${error.message}`);
		}
	}

	async initScreenShotNotification() {
		try {
			if (!this.notificationWindow) {
				this.notificationWindow = new ScreenCaptureNotification(
					this.getUiPath('screen-capture'),
					this.getPreloadPath()
				);
				await this.notificationWindow.loadURL();
				return;
			}
		} catch (error) {
			console.error('Failed to initialize screenshot notification', error);
		}
	}

	closeSettingWindow() {
		if (this.settingWindow && !this.settingWindow?.isDestroyed()) {
			this.settingWindow.close();
			this.settingWindow = null;
			this.dockHideHandle();
		}
	}

	closeLogWindow() {
		if (this.logWindow && !this.logWindow.isDestroyed()) {
			this.logWindow.close();
			this.logWindow = null;
		}
	}
}

export default AppWindow;
