import * as remoteMain from '@electron/remote/main';
import { BrowserWindow, Menu } from 'electron';
import * as url from 'url';
import { attachTitlebarToWindow } from 'custom-electron-titlebar/main';

import log from 'electron-log';
import { WindowManager } from './concretes/window.manager';
import { RegisteredWindow } from './interfaces/iwindow.manager';
console.log = log.log;
Object.assign(console, log.functions);

const Store = require('electron-store');
const store = new Store();

export async function createAboutWindow(filePath, preloadPath?) {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting(preloadPath);
	const manager = WindowManager.getInstance();

	const window = new BrowserWindow(mainWindowSettings);
	remoteMain.enable(window.webContents);
	const launchPath = url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true,
		hash: '/about'
	});

	window.setIcon(store.get('filePath').iconPath);
	window.hide();
	await window.loadURL(launchPath);
	window.setMenu(null);

	window.on('show', () => {
		Menu.getApplicationMenu().getMenuItemById('gauzy-about').enabled = false;
	});

	window.on('close', (event) => {
		Menu.getApplicationMenu().getMenuItemById('gauzy-about').enabled = true;
		window.hide();
		event.preventDefault();
	});

	manager.register(RegisteredWindow.ABOUT, window);
	if (preloadPath) {
		attachTitlebarToWindow(window);
	}
	return window;
}

const windowSetting = (preloadPath) => {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: true,
		resizable: false,
		focusable: true,
		fullscreenable: false,
		roundedCorners: true,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			devTools: true,
			contextIsolation: false,
			sandbox: false
		},
		width: 300,
		height: 250,
		title: 'About',
		maximizable: false,
		show: false
	};
	if (preloadPath) {
		mainWindowSettings.webPreferences.preload = preloadPath;
		mainWindowSettings.titleBarOverlay = true;
		mainWindowSettings.titleBarStyle = 'hidden';
	}
	return mainWindowSettings;
};
