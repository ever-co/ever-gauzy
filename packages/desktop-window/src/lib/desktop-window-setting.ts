import * as remoteMain from '@electron/remote/main';
import { BrowserWindow } from 'electron';
import * as url from 'url';
import { attachTitlebarToWindow } from 'custom-electron-titlebar/main';

import log from 'electron-log';
import { WindowManager } from './concretes/window.manager';
import { RegisteredWindow } from './interfaces/iwindow.manager';
console.log = log.log;
Object.assign(console, log.functions);

const Store = require('electron-store');
const store = new Store();

export async function createSettingsWindow(settingsWindow, filePath, preloadPath?) {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting(preloadPath);
	const manager = WindowManager.getInstance();

	settingsWindow = new BrowserWindow(mainWindowSettings);
	remoteMain.enable(settingsWindow.webContents);
	const launchPath = url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true,
		hash: '/settings'
	});

	settingsWindow.hide();
	await settingsWindow.loadURL(launchPath);
	settingsWindow.setMenu(null);

	settingsWindow.on('close', (event) => {
		settingsWindow.hide();
		event.preventDefault();
	});

	settingsWindow.webContents.toggleDevTools();
	manager.register(RegisteredWindow.SETTINGS, settingsWindow);
	if (preloadPath) {
		attachTitlebarToWindow(settingsWindow);
	}
	return settingsWindow;
}

const windowSetting = (preloadPath?) => {
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
		width: 1000,
		height: 800,
		title: 'Settings',
		maximizable: false,
		show: false
	};
	if (preloadPath) {
		mainWindowSettings.webPreferences.preload = preloadPath;
		mainWindowSettings.titleBarStyle = 'hidden',
			mainWindowSettings.titleBarOverlay = true
	}
	const filesPath = store.get('filePath');
	mainWindowSettings.icon = filesPath.iconPath;
	return mainWindowSettings;
};
