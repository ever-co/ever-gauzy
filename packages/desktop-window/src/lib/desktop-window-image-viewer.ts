import * as remoteMain from '@electron/remote/main';
import { BrowserWindow } from 'electron';
import * as url from 'url';
import { attachTitlebarToWindow } from 'custom-electron-titlebar/main';
import log from 'electron-log';
import Store from 'electron-store';
import { WindowManager, RegisteredWindow } from '@gauzy/desktop-core';
console.log = log.log;
Object.assign(console, log.functions);

const store = new Store();

export async function createImageViewerWindow(imageViewWindow, filePath, preloadPath?) {
	const manager = WindowManager.getInstance();
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting(preloadPath);
	imageViewWindow = new BrowserWindow(mainWindowSettings);
	remoteMain.enable(imageViewWindow.webContents);
	const launchPath = url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true,
		hash: '/viewer'
	});

	imageViewWindow.hide();
	await imageViewWindow.loadURL(launchPath);
	imageViewWindow.setMenu(null);

	// imageViewWindow.webContents.toggleDevTools();
	imageViewWindow.on('close', (event) => {
		imageViewWindow.hide();
		event.preventDefault();
	});
	manager.register(RegisteredWindow.IMAGE_VIEWER, imageViewWindow);
	if (preloadPath) {
		attachTitlebarToWindow(imageViewWindow);
	}
	return imageViewWindow;
}

const windowSetting = (preloadPath) => {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: true,
		resizable: true,
		focusable: true,
		fullscreenable: true,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			devTools: true,
			contextIsolation: false,
			sandbox: false
		},
		width: 1000,
		height: 728,
		title: '',
		maximizable: true,
		show: false
	};

	const filesPath = store.get('filePath');
	mainWindowSettings.icon = filesPath.iconPath;
	if (preloadPath) {
		mainWindowSettings.titleBarStyle = 'hidden';
		mainWindowSettings.titleBarOverlay = true;
		mainWindowSettings.webPreferences.preload = preloadPath;
		if (process.platform === 'linux') {
			mainWindowSettings.frame = false;
		}
	}

	return mainWindowSettings;
};
