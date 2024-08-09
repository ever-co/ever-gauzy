import * as remoteMain from '@electron/remote/main';
import { BrowserWindow } from 'electron';
import * as url from 'url';

import log from 'electron-log';
import { WindowManager } from './concretes/window.manager';
import { RegisteredWindow } from './interfaces/iwindow.manager';
console.log = log.log;
Object.assign(console, log.functions);

const Store = require('electron-store');
const store = new Store();

export async function createServerWindow(serverWindow, config, filePath) {
	let mainWindowSettings: Electron.BrowserWindowConstructorOptions = null;
	mainWindowSettings = windowSetting();
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

	manager.register(RegisteredWindow.SERVER, serverWindow);

	return serverWindow;
}

const windowSetting = () => {
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

	const filesPath = store.get('filePath');
	mainWindowSettings.icon = filesPath.iconPath;
	return mainWindowSettings;
};
