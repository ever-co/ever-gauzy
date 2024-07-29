import * as remoteMain from '@electron/remote/main';
import { BrowserWindow, Menu, app } from 'electron';
import * as url from 'url';

import log from 'electron-log';
import { WindowManager } from './concretes/window.manager';
import { RegisteredWindow } from './interfaces/iwindow.manager';
console.log = log.log;
Object.assign(console, log.functions);

const Store = require('electron-store');
const store = new Store();

export async function createSetupWindow(setupWindow, value, filePath) {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting();
	const manager = WindowManager.getInstance();

	setupWindow = new BrowserWindow(mainWindowSettings);
	remoteMain.enable(setupWindow.webContents);

	const launchPath = url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true,
		hash: '/setup'
	});

	if (value) {
		setupWindow.hide();
	}
	await setupWindow.loadURL(launchPath);
	setupWindow.setMenu(
		Menu.buildFromTemplate([
			{
				label: app.getName(),
				submenu: [{ role: 'quit', label: 'Exit' }]
			}
		])
	);
	// setupWindow.webContents.toggleDevTools();

	setupWindow.on('close', (e) => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		e.preventDefault();
		setupWindow.hide(); // gauzyWindow = null;
	});

	manager.register(RegisteredWindow.SETUP, setupWindow);
	return setupWindow;
}

const windowSetting = () => {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: true,
		resizable: false,
		focusable: true,
		fullscreenable: false,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			contextIsolation: false,
			sandbox: false
		},
		width: 960,
		height: 680,
		title: 'Setup',
		autoHideMenuBar: true,
		maximizable: false,
		show: false
	};
	const filesPath = store.get('filePath');
	mainWindowSettings.icon = filesPath.iconPath;
	return mainWindowSettings;
};
