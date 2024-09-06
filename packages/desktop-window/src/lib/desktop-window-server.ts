import * as remoteMain from '@electron/remote/main';
import { BrowserWindow } from 'electron';
import * as url from 'url';

import log from 'electron-log';
import { WindowManager } from './concretes/window.manager';
import { RegisteredWindow } from './interfaces/iwindow.manager';
import { attachTitlebarToWindow } from 'custom-electron-titlebar/main';
console.log = log.log;
Object.assign(console, log.functions);

const Store = require('electron-store');
const store = new Store();

export async function createServerWindow(serverWindow, config, filePath, preloadPath?) {
	let mainWindowSettings: Electron.BrowserWindowConstructorOptions = null;
	mainWindowSettings = windowSetting(preloadPath);
	const manager = WindowManager.getInstance();

	serverWindow = new BrowserWindow(mainWindowSettings);

	remoteMain.enable(serverWindow.webContents);

	let launchPath;

	launchPath = url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true,
		hash: '/server-dashboard'
	});

	await serverWindow.loadURL(launchPath);

	console.log('launched electron with:', launchPath);
	// serverWindow.webContents.toggleDevTools();

	serverWindow.on('close', (e) => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		e.preventDefault();
		serverWindow.hide(); // gauzyWindow = null;
	});

	if (preloadPath) {
		attachTitlebarToWindow(serverWindow);
	}
	manager.register(RegisteredWindow.SERVER, serverWindow);

	return serverWindow;
}

const windowSetting = (preloadPath?) => {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: true,
		resizable: false,
		focusable: true,
		fullscreenable: true,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			contextIsolation: false,
			sandbox: false
		},
		width: 380,
		height: 400,
		title: process.env.DESCRIPTION || '',
		show: false,
		center: true
	};

	if (preloadPath) {
		mainWindowSettings.webPreferences.preload = preloadPath;
		mainWindowSettings.titleBarStyle = 'hidden';
		mainWindowSettings.titleBarOverlay = true;
		if (process.platform === 'linux') {
			mainWindowSettings.frame = false;
		}
	}
	const filesPath = store.get('filePath');
	mainWindowSettings.icon = filesPath.iconPath;
	return mainWindowSettings;
};
