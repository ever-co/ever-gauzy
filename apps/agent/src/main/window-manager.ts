import {
	createAboutWindow,
	SplashScreen,
	createSetupWindow
} from '@gauzy/desktop-window';
import { BrowserWindow } from 'electron';
import { resolveHtmlPath } from './util';
import * as path from 'path';

class AppWindow {
	aboutWindow: BrowserWindow | null;
	splashScreenWindow: SplashScreen;
	setupWindow: BrowserWindow;
	rootPath: string;
	private static instance: AppWindow;
	constructor(rootPath: string) {
		if (AppWindow.getInstance(rootPath)) {
			return AppWindow.instance;
		}
		AppWindow.instance= this;
		this.rootPath = rootPath;
	}

	static getInstance(rootPath: string) {
		if (!AppWindow.instance) {
			AppWindow.instance = new AppWindow(rootPath);
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
			console.log('Failed to initialize about window', error)
			throw Error(`About window initialization failed: ${error.message}`);
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
			console.log('Failed to initialize splash screen window', error);
			throw Error(`SplashScreen window initialization failed: ${error.message}`);
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
			console.log('Failed to initialize setup window', error);
			throw Error(`Setup window initialization failed: ${error.message}`);
		}
	}
}

export default AppWindow;
