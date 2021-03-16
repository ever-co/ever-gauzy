import { BrowserWindow } from 'electron';
import * as path from 'path';
import * as url from 'url';

export function createTimeTrackerWindow(timeTrackerWindow, filePath) {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting();

	timeTrackerWindow = new BrowserWindow(mainWindowSettings);

	const launchPath = url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true,
		hash: '/time-tracker'
	});
	// timeTrackerWindow.webContents.openDevTools();

	timeTrackerWindow.hide();
	timeTrackerWindow.loadURL(launchPath);
	timeTrackerWindow.setMenu(null);
	timeTrackerWindow.on('close', (event) => {
		event.preventDefault();
		timeTrackerWindow.hide();
	});
	return timeTrackerWindow;
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
			enableRemoteModule: true
		},
		width: 400,
		height: 900,
		maximizable: false
	};

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
