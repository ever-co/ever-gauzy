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
		if (!this.aboutWindow) {
			this.aboutWindow = await createAboutWindow(this.getUiPath('about'), this.getPreloadPath());
			this.aboutWindow.once('close', () => {
				console.log('on close about window');
				this.aboutWindow.destroy();
				this.aboutWindow = null;
			});
			this.aboutWindow.once('ready-to-show', () => {
				this.aboutWindow.show();
			})
		}
	}

	async initSplashScreenWindow() {
		if (!this.splashScreenWindow) {
			this.splashScreenWindow = new SplashScreen(this.getUiPath('splash-screen'), this.getPreloadPath(), true);
			this.splashScreenWindow.browserWindow.on('close', () => {
				this.splashScreenWindow.browserWindow.destroy();
			});
		}
	}

	async initSetupWindow() {
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
	}
}

export default AppWindow;
