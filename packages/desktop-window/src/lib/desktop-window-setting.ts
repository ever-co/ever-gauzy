import { BrowserWindow } from 'electron';
import * as url from 'url';
import * as remoteMain from '@electron/remote/main';
const Store = require('electron-store');
const store = new Store();
 
export function createSettingsWindow(settingsWindow, filePath) {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting();

	settingsWindow = new BrowserWindow(mainWindowSettings);
	remoteMain.enable(settingsWindow.webContents)
	const launchPath = url.format({
		pathname: filePath,
		protocol: 'file:',
		slashes: true,
		hash: '/settings'
	});

	settingsWindow.hide();
	settingsWindow.loadURL(launchPath);
	settingsWindow.setMenu(null);

	settingsWindow.on('close', (event) => {
		settingsWindow.hide();
		event.preventDefault();
	});

	// settingsWindow.webContents.toggleDevTools();

	return settingsWindow;
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
	const filesPath = store.get('filePath');
	if (process.platform === 'linux') {
		mainWindowSettings.icon = filesPath.iconPath;
	}

	return mainWindowSettings;
};
