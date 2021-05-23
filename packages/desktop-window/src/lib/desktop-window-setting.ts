import { BrowserWindow } from 'electron';
import * as url from 'url';

export function createSettingsWindow(settingsWindow, filePath) {
	const mainWindowSettings: Electron.BrowserWindowConstructorOptions = windowSetting();

	settingsWindow = new BrowserWindow(mainWindowSettings);

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
			enableRemoteModule: true,
			contextIsolation: false
		},
		width: 1000,
		height: 800,
		title: 'Settings',
		maximizable: false,
		show: false
	};

	return mainWindowSettings;
};
