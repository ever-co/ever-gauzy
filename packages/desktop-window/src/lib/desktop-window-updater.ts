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

export async function createUpdaterWindow(updaterWindow, filePath, preloadPath?) {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting(preloadPath);
	const manager = WindowManager.getInstance();

	updaterWindow = new BrowserWindow(mainWindowSettings);
	remoteMain.enable(updaterWindow.webContents);
	const launchPath = url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true,
		hash: '/updater'
	});

	updaterWindow.hide();
	await updaterWindow.loadURL(launchPath);
	updaterWindow.setMenu(null);

	// updaterWindow.webContents.toggleDevTools();

	updaterWindow.on('close', (event) => {
		updaterWindow.hide();
		event.preventDefault();
	});

	manager.register(RegisteredWindow.UPDATER, updaterWindow);
	if (preloadPath) {
		attachTitlebarToWindow(updaterWindow);
	}
	return updaterWindow;
}

const windowSetting = (preloadPath) => {
	const filesPath = store.get('filePath');
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: true,
		resizable: false,
		focusable: true,
		fullscreenable: false,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			devTools: true,
			contextIsolation: false,
			sandbox: false
		},
		width: 700,
		height: 600,
		title: 'Gauzy Updater',
		maximizable: false,
		show: false
	};
	mainWindowSettings.icon = filesPath.iconPath;
	if (preloadPath) {
		mainWindowSettings.webPreferences.preload = preloadPath;
		mainWindowSettings.titleBarOverlay = true;
		mainWindowSettings.titleBarStyle = 'hidden';
		if (process.platform === 'linux') {
			mainWindowSettings.frame = false;
		}
	}
	return mainWindowSettings;
};
