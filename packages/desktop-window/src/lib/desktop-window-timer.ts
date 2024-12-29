import * as remoteMain from '@electron/remote/main';
import { BrowserWindow, screen } from 'electron';
import * as url from 'url';
import { attachTitlebarToWindow } from 'custom-electron-titlebar/main';

import log from 'electron-log';
import { WindowManager, RegisteredWindow } from '@gauzy/desktop-core';
console.log = log.log;
Object.assign(console, log.functions);

const Store = require('electron-store');
const store = new Store();

function getScreenSize() {
	const sizes = screen.getPrimaryDisplay().workAreaSize;
	const width = sizes.height < 768 ? 310 : 360;
	const height = sizes.height < 768 ? sizes.height - 20 : 768;
	return { width, height };
}

export async function createTimeTrackerWindow(timeTrackerWindow, filePath, preloadPath?) {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting(preloadPath);
	const manager = WindowManager.getInstance();

	timeTrackerWindow = new BrowserWindow(mainWindowSettings);
	remoteMain.enable(timeTrackerWindow.webContents);

	const launchPath = url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true,
		hash: '/time-tracker'
	});
	// timeTrackerWindow.webContents.openDevTools();

	timeTrackerWindow.hide();
	await timeTrackerWindow.loadURL(launchPath);
	if (preloadPath) {
		attachTitlebarToWindow(timeTrackerWindow);
	}
	const { width, height } = getScreenSize();
	timeTrackerWindow.setMinimumSize(width, height);
	timeTrackerWindow.setMenu(null);
	timeTrackerWindow.on('close', (event) => {
		event.preventDefault();
		timeTrackerWindow.hide();
	});

	manager.register(RegisteredWindow.TIMER, timeTrackerWindow);

	return timeTrackerWindow;
}

const windowSetting = (preloadPath?) => {
	const sizes = screen.getPrimaryDisplay().workAreaSize;
	const { width, height } = getScreenSize();
	const zoomF = sizes.height < 768 ? 0.8 : 1.0;
	const filesPath = store.get('filePath');
	console.log('file path == ', filesPath);
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = {
		frame: true,
		resizable: false,
		focusable: true,
		fullscreenable: false,
		webPreferences: {
			nodeIntegration: true,
			webSecurity: false,
			contextIsolation: false,
			zoomFactor: zoomF,
			sandbox: false
		},
		width: width,
		height: height,
		title: process.env.DESCRIPTION || 'Time Tracker',
		maximizable: false,
		show: false,
		icon: filesPath.iconPath
	};
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

export function loginPage(filePath) {
	return url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true,
		hash: '/auth/login'
	});
}

export function timeTrackerPage(filePath) {
	return url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true,
		hash: '/time-tracker'
	});
}
