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

	constructor(rootPath: string) {
		this.rootPath = rootPath;
	}

	getUiPath(hashPath: string) {
		return resolveHtmlPath('index.html', hashPath);
	}

	getPreloadPath() {
		return path.join(this.rootPath, 'main', 'preload.js');
	}

	async initAboutWindow() {
		this.aboutWindow = await createAboutWindow(this.getUiPath('about'), this.getPreloadPath());
		this.aboutWindow.on('close', () => {
			this.aboutWindow.destroy();
		});
	}

	async initSplashScreenWindow() {
		this.splashScreenWindow = new SplashScreen(this.getUiPath('splash-screen'), this.getPreloadPath(), true);
		this.splashScreenWindow.browserWindow.on('close', () => {
			this.splashScreenWindow.browserWindow.destroy();
		})
	}

	async initSetupWindow() {
		this.setupWindow =  await createSetupWindow(
			this.setupWindow,
			true,
			this.getUiPath('setup'),
			this.getPreloadPath(),
			true
		);
		this.setupWindow.webContents.toggleDevTools();
		this.setupWindow.on('close', () => {
			this.setupWindow.destroy();
		})
	}
}

export default AppWindow;
