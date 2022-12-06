import { BrowserWindow, screen } from 'electron';
import * as url from 'url';
import * as remoteMain from '@electron/remote/main';
const Store = require('electron-store');
const store = new Store();

export function createTimeTrackerWindow(timeTrackerWindow, filePath) {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting();

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
	timeTrackerWindow.loadURL(launchPath);
	timeTrackerWindow.setMenu(null);
	timeTrackerWindow.on('close', (event) => {
		event.preventDefault();
		timeTrackerWindow.hide();
	});
	return timeTrackerWindow;
}

const windowSetting = () => {
	const sizes = screen.getPrimaryDisplay().workAreaSize;
	const height = sizes.height < 768 ? sizes.height - 20 : 768;
	const zoomF = sizes.height < 768 ? 0.8 : 1.0;
	const width = sizes.height < 768 ? 310 : 360;
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
		title: 'Time Tracker',
		maximizable: false,
		show: false,
		
	};

	if (process.platform === 'linux') {
		mainWindowSettings.icon = filesPath.iconPath;
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
